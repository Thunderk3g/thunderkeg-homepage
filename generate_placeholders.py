import os
import math
import random
from PIL import Image, ImageDraw, ImageFont

# Set up output directories relative to workspace
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
TEXTURES_DIR = os.path.join(OUTPUT_DIR, "public", "textures")
SKY_DIR = os.path.join(OUTPUT_DIR, "public", "sky")
UI_DIR = os.path.join(OUTPUT_DIR, "public", "ui")
ICONS_DIR = os.path.join(OUTPUT_DIR, "public", "icons")
ART_DIR = os.path.join(OUTPUT_DIR, "public", "art")

# Ghibli-inspired palette colors (RGBA)
SKY_BLUE = (191, 227, 240, 255)     # #bfe3f0
PEACH = (251, 233, 200, 255)        # #fbe9c8
SAGE = (168, 207, 143, 255)         # #a8cf8f
TERRACOTTA = (200, 116, 95, 255)     # #c8745f
LAVENDER = (205, 188, 232, 255)     # #cdbce8
CREAM = (247, 241, 227, 255)        # #f7f1e3
DARK_INK = (60, 55, 50, 255)
GOLD = (245, 190, 80, 255)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

# Helper to find system fonts
def get_best_font(size):
    font_paths = [
        "C:\\Windows\\Fonts\\Gabriola.ttf",
        "C:\\Windows\\Fonts\\Georgia.ttf",
        "C:\\Windows\\Fonts\\Calibri.ttf",
        "C:\\Windows\\Fonts\\arial.ttf"
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                pass
    return ImageFont.load_default()

# Canvas creation with 4x supersampling (anti-aliasing)
def create_canvas(width, height, fill_color=TRANSPARENT):
    scale = 4
    img = Image.new("RGBA", (width * scale, height * scale), fill_color)
    draw = ImageDraw.Draw(img)
    return img, draw, scale

# Resize and save canvas
def save_canvas(img, filename, scale, apply_grain=True):
    width, height = img.width // scale, img.height // scale
    if apply_grain:
        # Apply a subtle watercolor/paper grain texture
        pixels = img.load()
        w_s, h_s = img.size
        # Deterministic seed for reproducible quality
        random.seed(hash(filename) % 1234567)
        for x in range(0, w_s, 2):
            for y in range(0, h_s, 2):
                # Only apply to semi-opaque pixels
                a = pixels[x, y][3]
                if a > 50:
                    noise = random.randint(-12, 12)
                    for dx in range(2):
                        for dy in range(2):
                            if x+dx < w_s and y+dy < h_s:
                                r, g, b, alpha = pixels[x+dx, y+dy]
                                pixels[x+dx, y+dy] = (
                                    max(0, min(255, r + noise)),
                                    max(0, min(255, g + noise)),
                                    max(0, min(255, b + noise)),
                                    alpha
                                )
    img_resized = img.resize((width, height), Image.Resampling.LANCZOS)
    img_resized.save(filename, "PNG")
    print(f"Regenerated: {filename}")

# --- ADVANCED PAINTERLY DRAWING UTILITIES ---

def draw_gradient_rect(draw, box, color1, color2, vertical=True):
    x0, y0, x1, y1 = box
    h = int(y1 - y0) if vertical else int(x1 - x0)
    for i in range(h):
        t = i / float(h)
        c = tuple(int(color1[j] * (1-t) + color2[j] * t) for j in range(4))
        if vertical:
            draw.line([(x0, y0 + i), (x1, y0 + i)], fill=c)
        else:
            draw.line([(x0 + i, y0), (x0 + i, y1)], fill=c)

def draw_soft_shadow(draw, box, radius=12, opacity=50, shape="ellipse"):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    rx, ry = (x1 - x0) // 2, (y1 - y0) // 2
    # Draw concentric layers of black shadows with high transparency
    for i in range(radius):
        factor = (i / float(radius))
        op = int(opacity * (1.0 - factor))
        fill_col = (45, 40, 35, op)
        offset = i
        if shape == "ellipse":
            draw.ellipse((cx - rx - offset, cy - ry - offset, cx + rx + offset, cy + ry + offset), fill=fill_col)
        elif shape == "rect":
            draw.rounded_rectangle((x0 - offset, y0 - offset, x1 + offset, y1 + offset), radius=8, fill=fill_col)

def draw_wood_grain(draw, center, radius, color_base, color_grain):
    cx, cy = center
    # Draw background plate
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=color_base)
    # Draw concentric wood grain ripples
    random.seed(12)
    for r in range(int(radius * 0.2), int(radius * 0.95), 18):
        # Slightly distort the circle for organic look
        pts = []
        steps = 40
        for i in range(steps + 1):
            angle = i * (2 * math.pi / steps)
            # Add distortion wave
            r_distorted = r + 5 * math.sin(3 * angle) + random.randint(-2, 2)
            x = cx + r_distorted * math.cos(angle)
            y = cy + r_distorted * math.sin(angle)
            pts.append((x, y))
        draw.line(pts, fill=(color_grain[0], color_grain[1], color_grain[2], 120), width=3)

def draw_heart(draw, center, size, fill, outline=None, width=0):
    cx, cy = center
    hs = size // 2
    # Draw soft shadow under heart
    draw.ellipse((cx - size, cy - hs//2, cx + size, cy + size), fill=(40, 30, 20, 40))
    # Left loop
    draw.ellipse((cx - size, cy - hs - hs//2, cx, cy + hs//2), fill=fill, outline=outline, width=width)
    # Right loop
    draw.ellipse((cx, cy - hs - hs//2, cx + size, cy + hs//2), fill=fill, outline=outline, width=width)
    # Bottom triangle
    draw.polygon([(cx - size, cy), (cx + size, cy), (cx, cy + size)], fill=fill, outline=outline, width=width)
    # Clean inner lines
    draw.ellipse((cx - size + 2, cy - hs - hs//2 + 2, cx - 2, cy + hs//2 - 2), fill=fill)
    draw.ellipse((cx + 2, cy - hs - hs//2 + 2, cx + size - 2, cy + hs//2 - 2), fill=fill)
    draw.polygon([(cx - size + 3, cy - 3), (cx + size - 3, cy - 3), (cx, cy + size - 3)], fill=fill)

def draw_star(draw, center, r_out, r_in, fill, outline=None, width=0, points=5):
    cx, cy = center
    points_list = []
    for i in range(2 * points):
        r = r_out if i % 2 == 0 else r_in
        angle = i * math.pi / points - math.pi / 2
        x = cx + r * math.cos(angle)
        y = cy + r * math.sin(angle)
        points_list.append((x, y))
    draw.polygon(points_list, fill=fill, outline=outline, width=width)

def draw_leaf(draw, center, size, angle_deg, fill):
    cx, cy = center
    angle = math.radians(angle_deg)
    pts = []
    for i in range(11):
        t = i / 10.0
        # Curve 1
        x1 = cx + (t - 0.5) * size * math.cos(angle) - (t * (1-t)) * size * 0.4 * math.sin(angle)
        y1 = cy + (t - 0.5) * size * math.sin(angle) + (t * (1-t)) * size * 0.4 * math.cos(angle)
        pts.append((x1, y1))
    for i in range(10, -1, -1):
        t = i / 10.0
        # Curve 2
        x2 = cx + (t - 0.5) * size * math.cos(angle) + (t * (1-t)) * size * 0.4 * math.sin(angle)
        y2 = cy + (t - 0.5) * size * math.sin(angle) - (t * (1-t)) * size * 0.4 * math.cos(angle)
        pts.append((x2, y2))
    draw.polygon(pts, fill=fill)

# --- REWORKED HIGH QUALITY GENERATORS ---

def generate_avatar():
    img, draw, s = create_canvas(1024, 1024)
    # Circle Background with soft gradient
    cx, cy = 512*s, 512*s
    r = 450*s
    # Shadow under background
    draw_soft_shadow(draw, (cx-r, cy-r, cx+r, cy+r), radius=20*s, opacity=60)
    for i in range(r, 0, -6*s):
        factor = i / float(r)
        c = tuple(int(LAVENDER[j] * (0.8 + 0.2*factor) + PEACH[j] * (0.2 - 0.2*factor)) for j in range(4))
        draw.ellipse((cx - i, cy - i, cx + i, cy + i), fill=c)

    # Soft ambient glow behind character
    draw.ellipse((250*s, 250*s, 770*s, 770*s), fill=(255, 255, 255, 80))

    # Chibi character body (sage coat)
    draw_soft_shadow(draw, (220*s, 640*s, 800*s, 1100*s), radius=12*s, opacity=40)
    draw.ellipse((220*s, 640*s, 800*s, 1150*s), fill=SAGE)
    # Shirt inner (terracotta)
    draw.polygon([(470*s, 640*s), (554*s, 640*s), (512*s, 720*s)], fill=TERRACOTTA)
    # White collar
    draw.polygon([(460*s, 640*s), (500*s, 670*s), (490*s, 640*s)], fill=WHITE)
    draw.polygon([(564*s, 640*s), (524*s, 670*s), (534*s, 640*s)], fill=WHITE)

    # Neck
    draw.rectangle((462*s, 500*s, 562*s, 660*s), fill=PEACH)
    # Neck shadow
    draw.rectangle((462*s, 530*s, 562*s, 570*s), fill=(180, 140, 110, 100))

    # Head
    draw.ellipse((350*s, 240*s, 674*s, 560*s), fill=PEACH)

    # Hair (Dark brown textured & styled layers)
    hair_color = (65, 50, 40, 255)
    hair_shadow = (45, 35, 30, 255)
    # Back hair
    draw.ellipse((310*s, 220*s, 710*s, 500*s), fill=hair_shadow)
    # Top hair volume
    draw.ellipse((330*s, 190*s, 694*s, 380*s), fill=hair_color)
    # Hair strands/bangs
    draw.polygon([(340*s, 320*s), (380*s, 280*s), (390*s, 350*s)], fill=hair_color)
    draw.polygon([(684*s, 320*s), (644*s, 280*s), (634*s, 350*s)], fill=hair_color)
    draw.polygon([(450*s, 260*s), (512*s, 340*s), (490*s, 250*s)], fill=hair_color)
    # Anime Hair Highlight (reflection arc)
    draw.arc((380*s, 210*s, 644*s, 300*s), 200, 340, fill=PEACH, width=12*s)

    # Eyes
    # White base
    draw.ellipse((440*s, 380*s, 480*s, 420*s), fill=WHITE, outline=DARK_INK, width=4*s)
    draw.ellipse((544*s, 380*s, 584*s, 420*s), fill=WHITE, outline=DARK_INK, width=4*s)
    # Iris
    draw.ellipse((450*s, 385*s, 478*s, 415*s), fill=DARK_INK)
    draw.ellipse((554*s, 385*s, 582*s, 415*s), fill=DARK_INK)
    # Sparkles
    draw.ellipse((454*s, 388*s, 464*s, 398*s), fill=WHITE)
    draw.ellipse((558*s, 388*s, 568*s, 398*s), fill=WHITE)

    # Blush
    draw.ellipse((400*s, 425*s, 444*s, 445*s), fill=(240, 140, 130, 150))
    draw.ellipse((580*s, 425*s, 624*s, 445*s), fill=(240, 140, 130, 150))

    # Smile (Arc)
    draw.arc((482*s, 440*s, 542*s, 480*s), 0, 180, fill=DARK_INK, width=8*s)

    # Glasses (Black frame with white glare reflection)
    draw.ellipse((400*s, 350*s, 500*s, 450*s), outline=DARK_INK, width=12*s)
    draw.ellipse((524*s, 350*s, 624*s, 450*s), outline=DARK_INK, width=12*s)
    draw.line((500*s, 400*s, 524*s, 400*s), fill=DARK_INK, width=12*s)
    # Glare lines
    draw.line((420*s, 370*s, 440*s, 390*s), fill=(255, 255, 255, 160), width=6*s)
    draw.line((544*s, 370*s, 564*s, 390*s), fill=(255, 255, 255, 160), width=6*s)

    save_canvas(img, os.path.join(ART_DIR, "avatar_portrait.png"), s)

def generate_panel_paper():
    img, draw, s = create_canvas(1024, 768)
    
    # Outer drop shadow
    draw_soft_shadow(draw, (35*s, 35*s, 989*s, 733*s), radius=25*s, opacity=50, shape="rect")
    
    # Paper Base with linear gradient (cream to peach-cream)
    draw_gradient_rect(draw, (40*s, 40*s, 984*s, 728*s), CREAM, (253, 246, 230, 255))
    
    # Edge tears
    for i in range(120*s, 904*s, 45*s):
        # Slightly offset circles to look organic
        offset_y = random.randint(-2*s, 2*s)
        draw.ellipse((i - 10*s, 30*s + offset_y, i + 10*s, 50*s + offset_y), fill=TRANSPARENT)
        draw.ellipse((i - 10*s, 718*s + offset_y, i + 10*s, 738*s + offset_y), fill=TRANSPARENT)
        
    # Borders (Double borders in warm terracotta and ink)
    draw.rounded_rectangle((60*s, 60*s, 964*s, 708*s), radius=32*s, outline=TERRACOTTA, width=6*s)
    draw.rounded_rectangle((70*s, 70*s, 954*s, 698*s), radius=24*s, outline=DARK_INK, width=2*s)

    # Decorative Corner Leaves (Typical Ghibli plant framing detail)
    corners = [(75*s, 75*s, 0), (949*s, 75*s, 90), (75*s, 693*s, -90), (949*s, 693*s, 180)]
    for cx, cy, rot in corners:
        draw_leaf(draw, (cx, cy), 30*s, rot + 45, fill=SAGE)
        draw_leaf(draw, (cx + 5*s * math.cos(math.radians(rot)), cy + 5*s * math.sin(math.radians(rot))), 20*s, rot + 15, fill=(130, 175, 105, 255))

    save_canvas(img, os.path.join(UI_DIR, "panel_paper.png"), s)

def generate_button():
    img, draw, s = create_canvas(256, 96)
    # Drop shadow
    draw_soft_shadow(draw, (6*s, 10*s, 250*s, 92*s), radius=8*s, opacity=60, shape="rect")
    
    # Wooden button (Terracotta gradient)
    draw_gradient_rect(draw, (8*s, 8*s, 248*s, 88*s), TERRACOTTA, (170, 90, 70, 255))
    
    # Light top highlight
    draw.line([(12*s, 10*s), (244*s, 10*s)], fill=PEACH, width=4*s)
    
    # Inner border frame
    draw.rounded_rectangle((16*s, 16*s, 240*s, 80*s), radius=12*s, outline=DARK_INK, width=4*s)
    
    # Subtle wood grain waves
    draw.arc((30*s, 20*s, 100*s, 50*s), 0, 180, fill=(160, 80, 60, 100), width=3*s)
    draw.arc((140*s, 40*s, 220*s, 70*s), 180, 360, fill=(160, 80, 60, 100), width=3*s)
    
    save_canvas(img, os.path.join(UI_DIR, "button.png"), s)

def generate_interact_prompt():
    img, draw, s = create_canvas(128, 128)
    # Golden glow
    draw_soft_shadow(draw, (12*s, 12*s, 116*s, 116*s), radius=16*s, opacity=70)
    # Bevel ring (Keycap frame)
    draw.ellipse((10*s, 10*s, 118*s, 118*s), fill=DARK_INK)
    draw.ellipse((14*s, 14*s, 114*s, 114*s), fill=PEACH)
    draw.ellipse((22*s, 22*s, 106*s, 106*s), fill=CREAM)
    
    # Glossy white shine
    draw.arc((24*s, 24*s, 104*s, 104*s), 190, 280, fill=WHITE, width=6*s)
    
    font = get_best_font(56*s)
    draw.text((45*s, 24*s), "E", fill=DARK_INK, font=font)
    
    save_canvas(img, os.path.join(UI_DIR, "interact_prompt.png"), s)

def generate_loading_screen():
    img, draw, s = create_canvas(1920, 1080)
    
    # Sunset sky gradient (sky blue -> warm peach -> deep lavender sunset)
    for y in range(1080 * s):
        t = y / (1080.0 * s)
        if t < 0.5:
            ft = t / 0.5
            r = int(SKY_BLUE[0]*(1-ft) + PEACH[0]*ft)
            g = int(SKY_BLUE[1]*(1-ft) + PEACH[1]*ft)
            b = int(SKY_BLUE[2]*(1-ft) + PEACH[2]*ft)
        else:
            ft = (t - 0.5) / 0.5
            r = int(PEACH[0]*(1-ft) + LAVENDER[0]*ft)
            g = int(PEACH[1]*(1-ft) + LAVENDER[1]*ft)
            b = int(PEACH[2]*(1-ft) + LAVENDER[2]*ft)
        draw.line([(0, y), (1920*s, y)], fill=(r, g, b, 255))
        
    # Giant painterly golden sun
    draw.ellipse((810*s, 320*s, 1110*s, 620*s), fill=PEACH)
    # Sun core glow
    draw.ellipse((860*s, 370*s, 1060*s, 570*s), fill=(255, 255, 230, 200))
    
    # Distant layered hills with soft gradients
    # Ridge 1 (Deep lavender)
    draw.polygon([(0, 620*s), (500*s, 480*s), (1000*s, 680*s), (1500*s, 520*s), (1920*s, 670*s), (1920*s, 1080*s), (0, 1080*s)], fill=LAVENDER)
    # Ridge 2 (Medium Sage-Green)
    draw.polygon([(0, 720*s), (650*s, 580*s), (1250*s, 750*s), (1920*s, 620*s), (1920*s, 1080*s), (0, 1080*s)], fill=SAGE)
    # Ridge 3 (Lush green foreground flat)
    draw.polygon([(0, 830*s), (850*s, 760*s), (1920*s, 860*s), (1920*s, 1080*s), (0, 1080*s)], fill=(145, 185, 120, 255))
    
    # Winding path with warm stone borders
    draw.polygon([(780*s, 770*s), (820*s, 770*s), (940*s, 1080*s), (680*s, 1080*s)], fill=PEACH)
    # Stone path dots
    for i in range(770*s, 1080*s, 40*s):
        ratio = (i - 770*s) / 310.0
        w = int(20*s * (1 + 4*ratio))
        cx = int(800*s + 40*s*ratio)
        draw.ellipse((cx - w//2, i - 10*s, cx + w//2, i + 10*s), fill=CREAM)
        
    # Cozy Ghibli Cottages
    # Cottage 1
    draw_house(draw, cx=1120*s, cy=690*s, w=120*s, h=90*s, base_color=CREAM, roof_color=TERRACOTTA, door_color=DARK_INK)
    # Cottage 2 (Smaller)
    draw_house(draw, cx=1260*s, cy=720*s, w=80*s, h=70*s, base_color=PEACH, roof_color=TERRACOTTA, door_color=DARK_INK)
    
    # High-quality puffy clouds floating in sky
    # Cloud cluster left
    draw.ellipse((150*s, 180*s, 380*s, 280*s), fill=(255, 255, 255, 190))
    draw.ellipse((220*s, 140*s, 440*s, 260*s), fill=(255, 255, 255, 190))
    draw.ellipse((350*s, 180*s, 500*s, 260*s), fill=(255, 255, 255, 190))
    
    # Cloud cluster right
    draw.ellipse((1400*s, 200*s, 1750*s, 310*s), fill=(255, 255, 255, 170))
    draw.ellipse((1520*s, 160*s, 1800*s, 290*s), fill=(255, 255, 255, 170))

    # Cozy lanterns along the path
    draw.rectangle((740*s, 860*s, 746*s, 920*s), fill=DARK_INK)
    draw.ellipse((735*s, 845*s, 751*s, 861*s), fill=GOLD) # lantern light
    
    save_canvas(img, os.path.join(UI_DIR, "loading_screen.png"), s)

def generate_logo():
    img, draw, s = create_canvas(1200, 400)
    font = get_best_font(100*s)
    text = "Diwakar Adhikari"
    # Soft warm drop-shadow offset
    draw.text((206*s, 146*s), text, fill=TERRACOTTA, font=font)
    draw.text((204*s, 144*s), text, fill=PEACH, font=font)
    # Master black ink font
    draw.text((200*s, 140*s), text, fill=DARK_INK, font=font)
    save_canvas(img, os.path.join(UI_DIR, "logo.png"), s)

def generate_favicon():
    img, draw, s = create_canvas(512, 512)
    # Soft background glow
    draw.ellipse((60*s, 60*s, 452*s, 452*s), fill=(251, 233, 200, 150))
    # cottage
    draw_house(draw, cx=256*s, cy=200*s, w=260*s, h=200*s, base_color=CREAM, roof_color=TERRACOTTA, door_color=SAGE)
    # chimney smoke
    draw.ellipse((350*s, 90*s, 390*s, 130*s), fill=(255,255,255,180))
    draw.ellipse((370*s, 60*s, 400*s, 90*s), fill=(255,255,255,180))
    save_canvas(img, os.path.join(UI_DIR, "favicon.png"), s)

# --- SIGNPOST ICONS ---

def generate_signpost_icons():
    icons_data = [
        ("about.png", "heart"),
        ("experience.png", "briefcase"),
        ("projects.png", "gear"),
        ("skills.png", "leaf"),
        ("awards.png", "medal"),
        ("contact.png", "envelope")
    ]
    
    for filename, symbol in icons_data:
        img, draw, s = create_canvas(256, 256)
        cx, cy = 128*s, 128*s
        
        # Soft outer icon drop-shadow
        draw_soft_shadow(draw, (20*s, 24*s, 236*s, 240*s), radius=10*s, opacity=50)
        
        # Round wooden signpost plate (detailed wood rings)
        draw_wood_grain(draw, (cx, cy), 108*s, color_base=TERRACOTTA, color_grain=(150, 70, 50))
        
        # Outer dark ring frame
        draw.ellipse((20*s, 20*s, 236*s, 236*s), outline=DARK_INK, width=8*s)
        
        # Inner plate (with soft radial cream gradient)
        r_inner = 86*s
        for r in range(r_inner, 0, -4*s):
            factor = r / float(r_inner)
            c = tuple(int(CREAM[j]*factor + PEACH[j]*(1.0 - factor)) for j in range(4))
            draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=c)
            
        # Draw golden outline highlight
        draw.ellipse((32*s, 32*s, 224*s, 224*s), outline=GOLD, width=3*s)
        
        # Symbol drawing
        if symbol == "heart":
            draw_heart(draw, (cx, cy - 20*s), 38*s, fill=TERRACOTTA)
        elif symbol == "briefcase":
            # Briefcase leather texture & details
            draw_gradient_rect(draw, (78*s, 100*s, 178*s, 170*s), DARK_INK, (40, 35, 30, 255))
            draw.arc((108*s, 80*s, 148*s, 110*s), 180, 360, fill=DARK_INK, width=8*s) # Handle
            # Gold buckle
            draw.rectangle((118*s, 125*s, 138*s, 145*s), fill=GOLD)
            draw.rectangle((125*s, 125*s, 131*s, 155*s), fill=DARK_INK)
        elif symbol == "gear":
            # Multi-layer gear
            draw.ellipse((82*s, 82*s, 174*s, 174*s), fill=DARK_INK)
            draw.ellipse((88*s, 88*s, 168*s, 168*s), fill=LAVENDER)
            draw.ellipse((110*s, 110*s, 146*s, 146*s), fill=CREAM)
            # Gear teeth
            for angle in range(0, 360, 45):
                rad = math.radians(angle)
                tx = cx + 84*s * math.cos(rad)
                ty = cy + 84*s * math.sin(rad)
                draw.ellipse((tx - 15*s, ty - 15*s, tx + 15*s, ty + 15*s), fill=DARK_INK)
        elif symbol == "leaf":
            # Open book with plant sprouting
            draw.polygon([(65*s, 155*s), (128*s, 140*s), (191*s, 155*s), (191*s, 125*s), (128*s, 110*s), (65*s, 125*s)], fill=PEACH, outline=DARK_INK, width=4*s)
            draw.line((128*s, 110*s, 128*s, 140*s), fill=DARK_INK, width=4*s) # spine
            # Leaves
            draw_leaf(draw, (cx - 16*s, cy - 20*s), 42*s, -45, fill=SAGE)
            draw_leaf(draw, (cx + 16*s, cy - 35*s), 42*s, 45, fill=SAGE)
            draw.line((cx, cy + 10*s, cx, cy - 30*s), fill=SAGE, width=8*s)
        elif symbol == "medal":
            # Golden medal
            draw.polygon([(100*s, 120*s), (80*s, 190*s), (115*s, 175*s)], fill=TERRACOTTA)
            draw.polygon([(156*s, 120*s), (176*s, 190*s), (141*s, 175*s)], fill=TERRACOTTA)
            draw.ellipse((90*s, 90*s, 166*s, 166*s), fill=GOLD, outline=DARK_INK, width=6*s)
            draw_star(draw, (cx, cy - 8*s), 22*s, 10*s, fill=WHITE)
        elif symbol == "envelope":
            # Textured envelope with heart seal
            draw.rectangle((76*s, 96*s, 180*s, 160*s), fill=PEACH, outline=DARK_INK, width=6*s)
            draw.polygon([(76*s, 96*s), (180*s, 96*s), (128*s, 132*s)], fill=CREAM, outline=DARK_INK, width=6*s)
            draw_heart(draw, (cx, cy + 10*s), 14*s, fill=TERRACOTTA)
            
        save_canvas(img, os.path.join(ICONS_DIR, filename), s)

# --- PROJECT POSTERS ---

def generate_project_posters():
    # project_metapod.png
    img, draw, s = create_canvas(768, 768)
    draw_gradient_rect(draw, (0, 0, 768*s, 768*s), LAVENDER, (90, 80, 110, 255))
    
    # Room/Scene grid lines (perspective floor)
    draw.line([(0, 600*s), (768*s, 600*s)], fill=DARK_INK, width=4*s)
    draw.line([(150*s, 600*s), (0, 768*s)], fill=DARK_INK, width=4*s)
    draw.line([(618*s, 600*s), (768*s, 768*s)], fill=DARK_INK, width=4*s)

    # Core Glowing Cryptographic Crystal Lockbox
    cx, cy = 384*s, 384*s
    draw_soft_shadow(draw, (234*s, 234*s, 534*s, 534*s), radius=35*s, opacity=80)
    # Multi-layered crystal face
    draw_star(draw, (cx, cy), 160*s, 160*s, fill=SKY_BLUE, outline=DARK_INK, width=12*s, points=6)
    draw_star(draw, (cx, cy), 120*s, 120*s, fill=(130, 210, 230, 255), points=6)
    draw_star(draw, (cx, cy), 80*s, 80*s, fill=WHITE, points=6)

    # Floating magical runes / stars
    draw_star(draw, (210*s, 180*s), 35*s, 14*s, fill=GOLD)
    draw_soft_shadow(draw, (180*s, 150*s, 240*s, 210*s), radius=15*s, opacity=60)
    
    draw_star(draw, (560*s, 190*s), 45*s, 18*s, fill=WHITE)
    draw_star(draw, (500*s, 500*s), 28*s, 11*s, fill=PEACH)
    
    save_canvas(img, os.path.join(ART_DIR, "project_metapod.png"), s)

    # project_krypto_tracker.png
    img, draw, s = create_canvas(768, 768)
    draw_gradient_rect(draw, (0, 0, 768*s, 768*s), PEACH, CREAM)
    
    # Cozy desk block
    draw.rectangle((80*s, 480*s, 688*s, 768*s), fill=TERRACOTTA, outline=DARK_INK, width=10*s)
    
    # Laptop screen
    draw_soft_shadow(draw, (184*s, 220*s, 584*s, 500*s), radius=20*s, opacity=50, shape="rect")
    draw.rounded_rectangle((184*s, 220*s, 584*s, 490*s), radius=16*s, fill=DARK_INK, width=10*s)
    # Screen inner display (Glowing grid & stock chart)
    draw.rectangle((198*s, 234*s, 570*s, 476*s), fill=(40, 45, 55, 255))
    # Green line chart
    chart_pts = [(220*s, 440*s), (280*s, 380*s), (340*s, 410*s), (410*s, 300*s), (480*s, 340*s), (550*s, 260*s)]
    draw.line(chart_pts, fill=SAGE, width=10*s)
    # Yellow glowing dots at peaks
    draw.ellipse((404*s, 294*s, 416*s, 306*s), fill=GOLD)
    draw.ellipse((544*s, 254*s, 556*s, 266*s), fill=GOLD)

    # Coffee Cup
    draw.rectangle((600*s, 410*s, 650*s, 480*s), fill=CREAM, outline=DARK_INK, width=6*s)
    # Cup handle
    draw.arc((635*s, 420*s, 665*s, 470*s), -90, 90, fill=DARK_INK, width=6*s)

    # Floating Gold Coins (With face detail)
    draw.ellipse((110*s, 380*s, 190*s, 460*s), fill=GOLD, outline=DARK_INK, width=6*s)
    draw_star(draw, (150*s, 420*s), 22*s, 10*s, fill=WHITE)
    
    save_canvas(img, os.path.join(ART_DIR, "project_krypto_tracker.png"), s)

    # project_pseudoserve.png
    img, draw, s = create_canvas(768, 768)
    draw_gradient_rect(draw, (0, 0, 768*s, 768*s), SAGE, CREAM)
    
    # Theater stage wooden base
    draw.rectangle((100*s, 500*s, 668*s, 680*s), fill=TERRACOTTA, outline=DARK_INK, width=12*s)
    
    # Theater main red canopy
    draw.rectangle((120*s, 150*s, 648*s, 240*s), fill=TERRACOTTA, outline=DARK_INK, width=10*s)
    # Left & Right Curtains (with soft shadow overlays)
    draw_gradient_rect(draw, (120*s, 240*s, 220*s, 500*s), TERRACOTTA, (150, 70, 50, 255), vertical=False)
    draw_gradient_rect(draw, (548*s, 240*s, 648*s, 500*s), (150, 70, 50, 255), TERRACOTTA, vertical=False)
    # Curtain outline
    draw.rectangle((120*s, 240*s, 220*s, 500*s), outline=DARK_INK, width=8*s)
    draw.rectangle((548*s, 240*s, 648*s, 500*s), outline=DARK_INK, width=8*s)
    
    # Golden stage star logo
    draw_star(draw, (384*s, 195*s), 30*s, 12*s, fill=GOLD)

    # Glowing API Card being handed out
    cx, cy = 384*s, 370*s
    draw_soft_shadow(draw, (270*s, 290*s, 498*s, 450*s), radius=20*s, opacity=70)
    draw.rounded_rectangle((270*s, 290*s, 498*s, 450*s), radius=16*s, fill=CREAM, outline=DARK_INK, width=8*s)
    # Text lines on API Card
    draw.line([(300*s, 330*s), (468*s, 330*s)], fill=DARK_INK, width=8*s)
    draw.line([(300*s, 365*s), (430*s, 365*s)], fill=SAGE, width=8*s)
    draw.line([(300*s, 400*s), (380*s, 400*s)], fill=TERRACOTTA, width=8*s)

    save_canvas(img, os.path.join(ART_DIR, "project_pseudoserve.png"), s)

# --- AWARD BADGES ---

def generate_award_badges():
    badges = [
        ("award_deployment_star.png", "star"),
        ("award_financial_innovation.png", "sprout"),
        ("award_compex.png", "scholar")
    ]
    for filename, symbol in badges:
        img, draw, s = create_canvas(512, 512)
        cx, cy = 256*s, 216*s
        
        # Ribbons (Multi-striped premium tails)
        draw.polygon([(206*s, 246*s), (170*s, 460*s), (230*s, 420*s)], fill=TERRACOTTA)
        draw.polygon([(216*s, 246*s), (190*s, 460*s), (230*s, 420*s)], fill=PEACH) # stripe
        
        draw.polygon([(306*s, 246*s), (342*s, 460*s), (282*s, 420*s)], fill=TERRACOTTA)
        draw.polygon([(296*s, 246*s), (322*s, 460*s), (282*s, 420*s)], fill=PEACH) # stripe
        
        # Medal outer shadow
        draw_soft_shadow(draw, (146*s, 106*s, 366*s, 326*s), radius=22*s, opacity=60)
        
        # Golden medal body with metallic rings
        draw.ellipse((146*s, 106*s, 366*s, 326*s), fill=DARK_INK)
        draw.ellipse((156*s, 116*s, 356*s, 316*s), fill=GOLD)
        draw.ellipse((176*s, 136*s, 336*s, 296*s), outline=WHITE, width=4*s) # shine ring
        draw.ellipse((186*s, 146*s, 326*s, 286*s), fill=(235, 170, 60, 255))
        
        if symbol == "star":
            draw_star(draw, (cx, cy), 55*s, 22*s, fill=WHITE, outline=DARK_INK, width=4*s)
        elif symbol == "sprout":
            # Sprout growing out of a coin
            draw.ellipse((cx - 25*s, cy + 20*s, cx + 25*s, cy + 45*s), fill=PEACH, outline=DARK_INK, width=4*s)
            draw_leaf(draw, (cx - 18*s, cy - 5*s), 35*s, -35, fill=SAGE)
            draw_leaf(draw, (cx + 18*s, cy - 15*s), 35*s, 35, fill=SAGE)
            draw.line((cx, cy + 25*s, cx, cy - 10*s), fill=SAGE, width=8*s)
        elif symbol == "scholar":
            # Open scholar book with laurel leaves
            draw.rectangle((210*s, 186*s, 302*s, 246*s), fill=CREAM, outline=DARK_INK, width=4*s)
            draw.line((256*s, 186*s, 256*s, 246*s), fill=DARK_INK, width=4*s)
            # laurel leaves framing book
            draw_leaf(draw, (180*s, 216*s), 28*s, 90, fill=SAGE)
            draw_leaf(draw, (332*s, 216*s), 28*s, -90, fill=SAGE)
            
        save_canvas(img, os.path.join(ART_DIR, filename), s)

# --- MINIGAME ART ---

def generate_minigame_art():
    # bug_creature.png
    img, draw, s = create_canvas(512, 512)
    # Soft shadow
    draw_soft_shadow(draw, (136*s, 146*s, 376*s, 386*s), radius=16*s, opacity=50)
    
    # Plump body
    draw.ellipse((136*s, 136*s, 376*s, 376*s), fill=SAGE, outline=DARK_INK, width=10*s)
    # Cute stripes on shell
    draw.ellipse((176*s, 176*s, 336*s, 336*s), fill=(145, 190, 120, 255))
    
    # 6 cute legs with curves
    legs = [
        # Left side
        [(140*s, 220*s), (90*s, 210*s)],
        [(136*s, 256*s), (80*s, 256*s)],
        [(140*s, 292*s), (90*s, 302*s)],
        # Right side
        [(372*s, 220*s), (422*s, 210*s)],
        [(376*s, 256*s), (432*s, 256*s)],
        [(372*s, 292*s), (422*s, 302*s)]
    ]
    for pts in legs:
        draw.line(pts, fill=DARK_INK, width=10*s)

    # Antennae
    draw.arc((196*s, 90*s, 246*s, 140*s), 180, 270, fill=DARK_INK, width=8*s)
    draw.arc((266*s, 90*s, 316*s, 140*s), 270, 360, fill=DARK_INK, width=8*s)
    draw.ellipse((191*s, 85*s, 201*s, 95*s), fill=GOLD)
    draw.ellipse((311*s, 85*s, 321*s, 95*s), fill=GOLD)

    # Big Ghibli Anime Eyes
    draw.ellipse((190*s, 180*s, 234*s, 224*s), fill=DARK_INK)
    draw.ellipse((278*s, 180*s, 322*s, 224*s), fill=DARK_INK)
    # Sparkles
    draw.ellipse((196*s, 186*s, 210*s, 200*s), fill=WHITE)
    draw.ellipse((284*s, 186*s, 298*s, 200*s), fill=WHITE)
    draw.ellipse((208*s, 204*s, 216*s, 212*s), fill=WHITE)
    draw.ellipse((296*s, 204*s, 304*s, 212*s), fill=WHITE)
    
    # Blush
    draw.ellipse((170*s, 220*s, 192*s, 232*s), fill=(255, 140, 130, 180))
    draw.ellipse((320*s, 220*s, 342*s, 232*s), fill=(255, 140, 130, 180))
    
    save_canvas(img, os.path.join(ART_DIR, "bug_creature.png"), s)

    # bug_poof.png
    img, draw, s = create_canvas(256, 256)
    # Overlapping watercolor puffs
    draw.ellipse((50*s, 70*s, 150*s, 170*s), fill=(215, 198, 242, 200))
    draw.ellipse((100*s, 50*s, 206*s, 156*s), fill=(255, 255, 255, 220))
    draw.ellipse((80*s, 100*s, 176*s, 196*s), fill=(251, 233, 200, 200))
    # Little sparkles
    draw_star(draw, (40*s, 55*s), 14*s, 6*s, fill=GOLD)
    draw_star(draw, (206*s, 160*s), 12*s, 5*s, fill=GOLD)
    save_canvas(img, os.path.join(ART_DIR, "bug_poof.png"), s)

    # badge_security_star.png
    img, draw, s = create_canvas(512, 512)
    # Shield drop shadow
    draw_soft_shadow(draw, (126*s, 86*s, 386*s, 436*s), radius=20*s, opacity=60)
    # Shield outer
    draw.polygon([(256*s, 80*s), (390*s, 130*s), (390*s, 340*s), (256*s, 440*s), (122*s, 340*s), (122*s, 130*s)], fill=GOLD, outline=DARK_INK, width=12*s)
    # Shield inner (gradient-like)
    draw.polygon([(256*s, 110*s), (360*s, 150*s), (360*s, 320*s), (256*s, 400*s), (152*s, 320*s), (152*s, 150*s)], fill=SKY_BLUE)
    # Star inside
    draw_star(draw, (256*s, 250*s), 65*s, 28*s, fill=WHITE, outline=DARK_INK, width=6*s)
    save_canvas(img, os.path.join(ART_DIR, "badge_security_star.png"), s)

    # event_packet.png
    img, draw, s = create_canvas(256, 256)
    cx, cy = 128*s, 128*s
    # Outer glow rings
    draw.ellipse((58*s, 58*s, 198*s, 198*s), fill=(191, 227, 240, 100))
    # Inner orb
    draw.ellipse((68*s, 68*s, 188*s, 188*s), fill=SKY_BLUE, outline=DARK_INK, width=4*s)
    draw.ellipse((88*s, 88*s, 168*s, 168*s), fill=WHITE)
    # Magical spark trails
    draw.line((30*s, 128*s, 60*s, 128*s), fill=GOLD, width=6*s)
    draw.line((196*s, 128*s, 226*s, 128*s), fill=GOLD, width=6*s)
    save_canvas(img, os.path.join(ART_DIR, "event_packet.png"), s)

    # badge_courier.png
    img, draw, s = create_canvas(512, 512)
    # Feathered angel wings
    # Left wing
    draw.ellipse((60*s, 170*s, 250*s, 290*s), fill=CREAM, outline=DARK_INK, width=8*s)
    draw.ellipse((90*s, 200*s, 240*s, 280*s), fill=WHITE) # feather detail
    # Right wing
    draw.ellipse((262*s, 170*s, 452*s, 290*s), fill=CREAM, outline=DARK_INK, width=8*s)
    draw.ellipse((272*s, 200*s, 422*s, 280*s), fill=WHITE) # feather detail
    
    # Envelope in center with shadow
    draw_soft_shadow(draw, (170*s, 196*s, 342*s, 306*s), radius=12*s, opacity=60)
    draw.rectangle((176*s, 196*s, 336*s, 306*s), fill=PEACH, outline=DARK_INK, width=8*s)
    # flap
    draw.polygon([(176*s, 196*s), (336*s, 196*s), (256*s, 252*s)], fill=PEACH, outline=DARK_INK, width=8*s)
    # Gold star seal
    draw_star(draw, (256*s, 256*s), 22*s, 10*s, fill=GOLD, outline=DARK_INK, width=3*s)
    save_canvas(img, os.path.join(ART_DIR, "badge_courier.png"), s)

    # card_back.png
    img, draw, s = create_canvas(512, 640)
    # Card base
    draw_soft_shadow(draw, (16*s, 16*s, 496*s, 624*s), radius=16*s, opacity=50)
    draw.rounded_rectangle((20*s, 20*s, 492*s, 620*s), radius=28*s, fill=CREAM, outline=DARK_INK, width=8*s)
    
    # Ornate inner border
    draw.rounded_rectangle((32*s, 32*s, 480*s, 608*s), radius=20*s, outline=TERRACOTTA, width=4*s)

    # Elegant retro repeating diamond flower pattern
    for x in range(80*s, 460*s, 80*s):
        for y in range(80*s, 590*s, 80*s):
            draw_heart(draw, (x, y - 5*s), 10*s, fill=TERRACOTTA)
            draw_leaf(draw, (x, y + 15*s), 16*s, 90, fill=SAGE)
            
    save_canvas(img, os.path.join(ART_DIR, "card_back.png"), s)

    # card_faces.png (1536 x 1024)
    img, draw, s = create_canvas(1536, 1024)
    card_w, card_h = 440, 440
    dx, dy = 60, 60
    
    symbols = ["gear", "key", "db", "lightning", "leaf", "star"]
    
    for idx, sym in enumerate(symbols):
        row = idx // 3
        col = idx % 3
        cx = col * (card_w + dx) + dx + card_w // 2
        cy = row * (card_h + dy) + dy + card_h // 2
        
        # Soft card shadow
        draw_soft_shadow(draw, ((cx - card_w//2)*s, (cy - card_h//2)*s, (cx + card_w//2)*s, (cy + card_h//2)*s), radius=12*s, opacity=50, shape="rect")
        # Draw card border
        draw.rounded_rectangle(((cx - card_w//2)*s, (cy - card_h//2)*s, (cx + card_w//2)*s, (cy + card_h//2)*s), radius=24*s, fill=CREAM, outline=DARK_INK, width=8*s)
        # Inner decorative line
        draw.rounded_rectangle(((cx - card_w//2 + 12)*s, (cy - card_h//2 + 12)*s, (cx + card_w//2 - 12)*s, (cy + card_h//2 - 12)*s), radius=16*s, outline=LAVENDER, width=3*s)
        
        # Center symbol
        scx, scy = cx*s, cy*s
        if sym == "gear":
            draw.ellipse((scx - 60*s, scy - 60*s, scx + 60*s, scy + 60*s), fill=DARK_INK)
            draw.ellipse((scx - 48*s, scy - 48*s, scx + 48*s, scy + 48*s), fill=LAVENDER)
            draw.ellipse((scx - 20*s, scy - 20*s, scx + 20*s, scy + 20*s), fill=CREAM)
            for angle in range(0, 360, 60):
                rad = math.radians(angle)
                tx = scx + 60*s * math.cos(rad)
                ty = scy + 60*s * math.sin(rad)
                draw.ellipse((tx - 18*s, ty - 18*s, tx + 18*s, ty + 18*s), fill=DARK_INK)
        elif sym == "key":
            draw.ellipse((scx - 40*s, scy - 70*s, scx + 40*s, scy + 10*s), outline=DARK_INK, width=12*s)
            draw.ellipse((scx - 30*s, scy - 60*s, scx + 30*s, scy), fill=PEACH)
            draw.line((scx, scy + 10*s, scx, scy + 90*s), fill=DARK_INK, width=12*s)
            draw.line((scx, scy + 50*s, scx + 40*s, scy + 50*s), fill=DARK_INK, width=12*s)
            draw.line((scx, scy + 75*s, scx + 40*s, scy + 75*s), fill=DARK_INK, width=12*s)
        elif sym == "db":
            draw.rounded_rectangle((scx - 60*s, scy - 80*s, scx + 60*s, scy - 20*s), radius=12*s, fill=LAVENDER, outline=DARK_INK, width=8*s)
            draw.rounded_rectangle((scx - 60*s, scy - 10*s, scx + 60*s, scy + 50*s), radius=12*s, fill=LAVENDER, outline=DARK_INK, width=8*s)
            # Database lines
            draw.ellipse((scx - 40*s, scy - 70*s, scx + 40*s, scy - 50*s), fill=WHITE)
            draw.ellipse((scx - 40*s, scy - 0*s, scx + 40*s, scy + 20*s), fill=WHITE)
        elif sym == "lightning":
            draw.polygon([(scx - 20*s, scy - 90*s), (scx + 40*s, scy - 10*s), (scx - 5*s, scy - 10*s), (scx + 20*s, scy + 90*s), (scx - 40*s, scy + 10*s), (scx + 5*s, scy + 10*s)], fill=GOLD, outline=DARK_INK, width=8*s)
        elif sym == "leaf":
            draw_leaf(draw, (scx, scy), 120*s, -45, fill=SAGE)
            # Vein detail
            draw.line((scx - 40*s, scy + 40*s, scx + 40*s, scy - 40*s), fill=WHITE, width=4*s)
        elif sym == "star":
            draw_star(draw, (scx, scy), 90*s, 38*s, fill=GOLD, outline=DARK_INK, width=8*s)

    save_canvas(img, os.path.join(ART_DIR, "card_faces.png"), s)

if __name__ == "__main__":
    print("Regenerating assets with advanced Ghibli painterly rendering...")
    generate_avatar()
    generate_panel_paper()
    generate_button()
    generate_interact_prompt()
    generate_loading_screen()
    generate_logo()
    generate_favicon()
    generate_signpost_icons()
    generate_project_posters()
    generate_award_badges()
    generate_minigame_art()
    print("All done!")
