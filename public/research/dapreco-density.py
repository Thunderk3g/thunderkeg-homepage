#!/usr/bin/env python3
"""Constraint density of the DAPRECO GDPR knowledge base.

Reproduces every number in /writing/coverage-is-not-constraint. Standard
library only. The numbers in the post are for the file as it stood on
31 Aug 2026 (5,633,102 bytes); upstream replaced it on 29 Sep 2026, so pin
the commit:

  curl -sSL -o rioKB_GDPR.xml https://raw.githubusercontent.com/dapreco/daprecokb/6676cd4781ed4f6dc7f8f2341295c21d25a23f22/gdpr/rioKB_GDPR.xml
  python3 dapreco-density.py rioKB_GDPR.xml

Definitions
  antecedent predicates  distinct ruleml:Rel/@iri under a rule's <ruleml:if>
  domain predicates      antecedent predicates outside the rioOnto: namespace
                         (reification plumbing, not legal content)
  ubiquitous predicate   in the antecedents of >= THRESHOLD of all rules
  selective predicate    a domain predicate that is not ubiquitous
  constraint density     |selective| / |domain|, per rule; a rule with no
                         domain predicate has no density and is left out
  density-0 rule         a rule with no selective predicate at all
"""
import re
import sys
from collections import Counter, defaultdict
from statistics import mean, median
from xml.etree import ElementTree as ET

R = '{http://ruleml.org/spec}'
L = '{http://docs.oasis-open.org/legalruleml/ns/v1.0/}'
THRESHOLD = 0.50
# Predicates that hold wherever the GDPR applies at all (Art. 2 and 4): the
# scope-only reading counts just these as non-discriminating. Processor and
# nominates are common in the corpus but false of a controller that processes
# the data itself, so a rule that requires them does separate scenarios.
SCOPE = {'prOnto:PersonalData', 'prOnto:DataSubject', 'prOnto:Controller', 'prOnto:PersonalDataProcessing'}


def load(path):
    """Every rule as (legal references, antecedent predicates)."""
    root = ET.parse(path).getroot()
    ref = {r.get('refersTo'): r.get('refID') for r in root.iter(L + 'LegalReference')}
    source = defaultdict(set)
    for assoc in root.iter(L + 'Association'):
        refs = {ref.get(s.get('keyref').lstrip('#')) for s in assoc.iter(L + 'appliesSource')}
        for target in assoc.iter(L + 'toTarget'):
            source[target.get('keyref').lstrip('#')] |= refs
    rules = []
    for block in root.iter(L + 'Statements'):
        for statement in block.iter(L + 'ConstitutiveStatement'):
            body = statement.find(R + 'Rule').find(R + 'if')
            antecedent = {rel.get('iri') for rel in body.iter(R + 'Rel') if rel.get('iri')}
            refs = source[statement.get('key')] | source[block.get('key')]
            rules.append((refs, antecedent))
    return rules


def article(ref_id):
    m = re.search(r'art_(\d+)(?:__para_(\d+))?(?:__content__list_1__point_([a-z]))?', ref_id or '')
    if not m:
        return 'no article (ontology-mapping rule)'
    return 'Art. ' + m.group(1) + ''.join(f'({g})' for g in m.groups()[1:] if g)


def measure(rules, ubiquitous):
    """Selective core of every rule that has a domain predicate, with its density."""
    out = []
    for refs, antecedent in rules:
        domain = {p for p in antecedent if not p.startswith('rioOnto:')}
        if domain:
            core = frozenset(domain - ubiquitous)
            out.append((refs, core, len(core) / len(domain)))
    return out


def ubiquitous_at(rules, threshold):
    freq = Counter(p for _, a in rules for p in a if not p.startswith('rioOnto:'))
    return {p for p, c in freq.items() if c / len(rules) >= threshold}, freq


def report(label, rules, ubiquitous):
    rows = measure(rules, ubiquitous)
    zero = sum(1 for _, _, d in rows if d == 0)
    low = sum(1 for _, core, _ in rows if len(core) <= 2)
    print(f'\n{label}')
    print(f'  mean constraint density     {mean(d for _, _, d in rows):.3f}')
    print(f'  median constraint density   {median(d for _, _, d in rows):.3f}')
    print(f'  density-0 rules             {zero} ({100 * zero / len(rules):.1f}%)')
    print(f'  rules with <=2 selective    {low} ({100 * low / len(rules):.1f}%)')
    print(f'  distinct selective cores    {len({core for _, core, _ in rows})} over {len(rows)} rules')
    return rows


def main(path):
    rules = load(path)
    n = len(rules)
    sizes = [len(a) for _, a in rules]
    ubiquitous, freq = ubiquitous_at(rules, THRESHOLD)
    print(f'rules                         {n}')
    print(f'distinct domain predicates    {len(freq)}')
    print(f'antecedent predicates / rule  mean {mean(sizes):.1f} · median {median(sizes):g} · max {max(sizes)}')
    print(f'ubiquitous (>= {THRESHOLD:.0%} of rules)   {len(ubiquitous)}')
    for p in sorted(ubiquitous, key=lambda p: -freq[p]):
        print(f'  {p:<32}{100 * freq[p] / n:.1f}%')

    rows = report(f'corpus-common reading: ubiquitous = in >= {THRESHOLD:.0%} of rules', rules, ubiquitous)
    report('scope-only reading: ubiquitous = ' + ', '.join(sorted(p.split(':')[1] for p in SCOPE)), rules, SCOPE)

    print('\nthreshold sweep\n  threshold  ubiquitous  mean density  density-0')
    for t in (0.90, 0.75, 0.50, 0.25, 0.10):
        u, _ = ubiquitous_at(rules, t)
        d = [x for _, _, x in measure(rules, u)]
        zero = sum(1 for x in d if x == 0)
        print(f'  {t:>8.0%}  {len(u):>10}  {mean(d):>12.3f}  {zero} ({100 * zero / n:.1f}%)')

    print('\nwhere the density-0 rules sit (corpus-common reading)')
    where = Counter()
    for refs, _, d in rows:
        if d == 0:
            where[' | '.join(sorted({article(r) for r in refs})) or article(None)] += 1
    for name, count in sorted(where.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f'  {count:>2}  {name}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
