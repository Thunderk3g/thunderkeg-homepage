"""Tiny models and tokenizers built on this machine, for tests that cannot download anything.

The tokenizer is a byte-level BPE trained with the `tokenizers` library and
wrapped in PreTrainedTokenizerFast; the model is built from a config, either
left at its random initialisation or trained for a short while. Both are saved
to a directory so tests load them through the same `from_pretrained` path a
real checkpoint takes.
"""

from __future__ import annotations

import random
import re
from pathlib import Path
from typing import Iterable

import torch
from tokenizers import Tokenizer, decoders, models, pre_tokenizers, trainers
from transformers import GPT2Config, GPT2LMHeadModel, LlamaConfig, LlamaForCausalLM, PreTrainedTokenizerFast

CORPUS = [
    "Elara had kept the key hidden for eleven years, and tonight she finally carried it up the hill.",
    "Shadows stretched across the path as the last of the light went out of the valley.",
    "The train pulled out of the station and nobody looked back at the empty platform.",
    "She opened the letter and read it twice before she let herself believe what it said.",
    "He set the cup down on the table, very carefully, as if the room might hear him.",
    "\"Is it still there?\" she asked. \"Where you left it,\" he said.",
    "Every summer the river rose a little higher — and every summer they pretended not to notice.",
    "The café on the corner stayed open late; the old teacher counted the coins twice.",
]


def train_tokenizer(texts: Iterable[str], vocab_size: int = 400, *, bos: bool = False) -> PreTrainedTokenizerFast:
    """A byte-level BPE tokenizer: any text encodes, and offsets map back to characters."""
    tok = Tokenizer(models.BPE())
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.decoder = decoders.ByteLevel()
    trainer = trainers.BpeTrainer(
        vocab_size=vocab_size,
        special_tokens=["<s>", "</s>"],
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
        show_progress=False,
    )
    tok.train_from_iterator(texts, trainer)
    if bos:
        from tokenizers import processors

        tok.post_processor = processors.TemplateProcessing(single="<s> $A", special_tokens=[("<s>", 0)])
    return PreTrainedTokenizerFast(tokenizer_object=tok, bos_token="<s>", eos_token="</s>")


def build_model(arch: str, vocab_size: int, *, hidden: int = 32, layers: int = 4, heads: int = 4, positions: int = 256):
    """A causal LM of the given architecture at its random initialisation."""
    if arch == "llama":
        config = LlamaConfig(
            vocab_size=vocab_size,
            hidden_size=hidden,
            intermediate_size=hidden * 2,
            num_hidden_layers=layers,
            num_attention_heads=heads,
            num_key_value_heads=max(1, heads // 2),
            max_position_embeddings=positions,
            bos_token_id=0,
            eos_token_id=1,
            tie_word_embeddings=True,
        )
        return LlamaForCausalLM(config)
    if arch == "gpt2":
        config = GPT2Config(
            vocab_size=vocab_size,
            n_embd=hidden,
            n_layer=layers,
            n_head=heads,
            n_positions=positions,
            bos_token_id=0,
            eos_token_id=1,
            resid_pdrop=0.0,
            embd_pdrop=0.0,
            attn_pdrop=0.0,
        )
        return GPT2LMHeadModel(config)
    raise ValueError(f"unknown architecture {arch!r}")


def save_tiny(path: Path, arch: str, *, seed: int = 0, texts: Iterable[str] = CORPUS, bos: bool | None = None, **shape) -> Path:
    """Write a random-init model and its tokenizer to `path`. Llama gets a BOS token, GPT-2 none."""
    torch.manual_seed(seed)
    tokenizer = train_tokenizer(texts, bos=(arch == "llama") if bos is None else bos)
    model = build_model(arch, len(tokenizer), **shape)
    model.save_pretrained(path)
    tokenizer.save_pretrained(path)
    return path


def train_lm(model, tokenizer, text: str, *, steps: int, batch: int = 32, window: int = 96, lr: float = 3e-3, seed: int = 0) -> float:
    """Train on random windows of one long text; return the mean loss over the last 20 steps."""
    rng = random.Random(seed)
    torch.manual_seed(seed)
    ids = torch.tensor(tokenizer(text)["input_ids"])
    optim = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    sched = torch.optim.lr_scheduler.OneCycleLR(optim, max_lr=lr, total_steps=steps, pct_start=0.1)
    model.train()
    tail: list[float] = []
    for step in range(steps):
        starts = [rng.randrange(0, len(ids) - window - 1) for _ in range(batch)]
        x = torch.stack([ids[s : s + window] for s in starts])
        loss = model(input_ids=x, labels=x).loss
        optim.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optim.step()
        sched.step()
        if step >= steps - 20:
            tail.append(loss.item())
    model.eval()
    return sum(tail) / len(tail)


# A synthetic language with two styles that can be counted. Every sentence is
# written in one tone (two vocabularies with no word in common) and at one pace
# (a single clause, or three to five joined by connectives), and a text tends
# to stay in the style it is in.

SUBJECTS = ["the man", "the girl", "the dog", "tom", "anna", "the old woman", "the boy", "the baker", "the sailor", "the teacher"]
WARM = {
    "verb": ["smiled", "laughed", "sang", "danced", "waved", "cheered"],
    "adj": ["kind", "bright", "sweet", "gentle", "merry", "glad"],
    "noun": ["garden", "sunlight", "honey", "song", "feast", "meadow"],
}
COLD = {
    "verb": ["wept", "frowned", "shivered", "groaned", "trembled", "sighed"],
    "adj": ["grim", "dark", "bitter", "harsh", "bleak", "sour"],
    "noun": ["grave", "ash", "frost", "storm", "ruin", "cellar"],
}
PLAIN = ["came home", "sat down", "looked up", "went out", "stood still", "walked on"]
LINKS = ["and then", "while", "because", "and so", "until", "but still"]
WARM_WORDS = frozenset(w for words in WARM.values() for w in words)
COLD_WORDS = frozenset(w for words in COLD.values() for w in words)


def toy_clause(rng: random.Random, tone: dict[str, list[str]]) -> str:
    subject = rng.choice(SUBJECTS)
    kind = rng.randrange(5)
    if kind == 0:
        return f"{subject} {rng.choice(tone['verb'])}"
    if kind == 1:
        return f"{subject} was {rng.choice(tone['adj'])}"
    if kind == 2:
        return f"{subject} saw the {rng.choice(tone['noun'])}"
    if kind == 3:
        return f"{subject} {rng.choice(tone['verb'])} in the {rng.choice(tone['adj'])} {rng.choice(tone['noun'])}"
    return f"{subject} {rng.choice(PLAIN)}"


def toy_sentence(rng: random.Random, tone: dict[str, list[str]], long: bool) -> str:
    parts = [toy_clause(rng, tone)]
    for _ in range(rng.randint(3, 5) - 1 if long else 0):
        parts += [rng.choice(LINKS), toy_clause(rng, tone)]
    return " ".join(parts) + " ."


def toy_passage(rng: random.Random, tone: dict[str, list[str]], long: bool, sentences: int) -> str:
    return " ".join(toy_sentence(rng, tone, long) for _ in range(sentences))


def toy_corpus(documents: int, seed: int = 0, stay: float = 0.8) -> str:
    """Documents one to a line. Each sentence keeps the tone and the pace of the one before it with probability `stay`."""
    rng = random.Random(seed)
    lines = []
    for _ in range(documents):
        tone, long = rng.choice([WARM, COLD]), rng.random() < 0.5
        sentences = []
        for _ in range(rng.randint(6, 10)):
            sentences.append(toy_sentence(rng, tone, long))
            if rng.random() > stay:
                tone = COLD if tone is WARM else WARM
            if rng.random() > stay:
                long = not long
        lines.append(" ".join(sentences))
    return "\n".join(lines) + "\n"


def warm_share(text: str) -> float:
    """Of the tone words in a text, the share that are warm; 0.5 when it has none."""
    words = text.split()
    warm, cold = sum(w in WARM_WORDS for w in words), sum(w in COLD_WORDS for w in words)
    return warm / (warm + cold) if warm + cold else 0.5


def _any(words: list[str]) -> str:
    return "(?:" + "|".join(words) + ")"


_VERB, _ADJ, _NOUN = (_any(WARM[kind] + COLD[kind]) for kind in ("verb", "adj", "noun"))
_CLAUSE = f"{_any(SUBJECTS)} (?:{_VERB}(?: in the {_ADJ} {_NOUN})?|was {_ADJ}|saw the {_NOUN}|{_any(PLAIN)})"
_SENTENCE = re.compile(f"{_CLAUSE}(?: {_any(LINKS)} {_CLAUSE})* \\.")


def well_formed(text: str) -> float:
    """The share of a text's finished sentences that are sentences of the toy language; 1.0 if it has none."""
    sentences = re.split(r"(?<= \.)[ \n]+", text.strip())
    if not sentences[-1].endswith(" ."):
        sentences = sentences[:-1]
    return sum(bool(_SENTENCE.fullmatch(s)) for s in sentences) / len(sentences) if sentences else 1.0
