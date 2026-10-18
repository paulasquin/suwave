"""Write the on-screen text (ASS) of the 30 s vertical video, in French and English.

    python3 captions.py   # -> captions_fr.ass, captions_en.ass
"""
CX, Y = 540, 1290  # text block centre (clear of Instagram's top and bottom overlays)

HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Big,Kit Unbounded Medium,64,&H00F8EEE8,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,-1,0,1,0,0,5,60,60,0,1
Style: Kicker,Kit Mono Medium,30,&H00FFD66F,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,6,0,1,0,0,5,60,60,0,1
Style: Sub,Kit Inter Medium,38,&H00D3BFB4,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1
Style: Number,Kit Unbounded Medium,170,&H00FFD66F,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,-4,0,1,0,0,5,60,60,0,1
Style: Title,Kit Unbounded Light,118,&H00F8EEE8,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,-4,0,1,0,0,5,60,60,0,1
Style: Url,Kit Mono Medium,36,&H00FFD66F,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,60,60,0,1
Style: Shade,Arial,20,&H00000000,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

ACCENT = r"{\c&HFFD66F&}"
WHITE = r"{\c&HF8EEE8&}"


def ts(s):
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{sec:05.2f}"


def line(start, end, style, text, y, rise=36, fade=(220, 200)):
    """One text element: a soft dark halo layer (for legibility) + the text, rising slightly."""
    move = rf"\move({CX},{y + rise},{CX},{y},0,420)"
    halo = rf"{{\an5{move}\fad({fade[0]},{fade[1]})\blur14\bord10\3c&H000000&\3a&H70&\1a&HFF&}}{text}"
    main = rf"{{\an5{move}\fad({fade[0]},{fade[1]})}}{text}"
    return [f"Dialogue: 0,{ts(start)},{ts(end)},{style},,0,0,0,,{halo}",
            f"Dialogue: 1,{ts(start)},{ts(end)},{style},,0,0,0,,{main}"]


def block(start, end, big=None, kicker=None, sub=None, number=None, dy=0):
    out = []
    y = Y + dy
    if kicker:
        out += line(start, end, "Kicker", kicker, y - 150, rise=20)
    if number:
        out += line(start, end, "Number", number, y - 20, rise=50)
        y += 110
    if big:
        out += line(start + 0.06, end, "Big", big.replace("\n", r"\N"), y)
    if sub:
        out += line(start + 0.18, end, "Sub", sub, y + (120 if big and "\n" in big else 90) if big else y, rise=24)
    return out


def ending(start, end, title, sub, url):
    shade = rf"{{\an7\pos(0,0)\fad(500,0)\1a&H50&\p1}}m 0 0 l 1080 0 l 1080 1920 l 0 1920{{\p0}}"
    out = [f"Dialogue: 0,{ts(start)},{ts(end)},Shade,,0,0,0,,{shade}"]
    out += line(start + 0.15, end, "Title", title.replace("\n", r"\N"), 1040, rise=50, fade=(400, 0))
    out += line(start + 0.45, end, "Sub", sub, 1265, rise=24, fade=(300, 0))
    out += line(start + 0.65, end, "Url", url, 1335, rise=20, fade=(300, 0))
    return out


# One entry per shot: (start, end, dict(kicker=, big=, sub=, number=, dy=)), then the end card
# ("end", title, subtitle, url). Keep big lines under ~17 characters (Unbounded is wide).
# ACCENT colours what follows; WHITE switches back.
TEXT = {
    "fr": [
        (0.4, 4.8, dict(kicker="PROJET · 2015", big="Le titre qui\naccroche")),
        (5.1, 7.3, dict(big="Une question\nqui intrigue ?")),
        (7.8, 14.6, dict(kicker="LA PIÈCE", big="Imprimée en 3D,\ncouche par couche")),
        (15.2, 22.2, dict(big=f"Le chiffre clé :\n{ACCENT}6,7 µN")),
        (22.8, 27.3, dict(kicker="LE RÉSULTAT", number="60", sub="images par seconde", dy=80)),
        ("end", f"projet\n{ACCENT}vitrine", "Tout le projet en 3D", "example.paulasquin.com"),
    ],
    "en": [
        (0.4, 4.8, dict(kicker="PROJECT · 2015", big="A hook\nof a title")),
        (5.1, 7.3, dict(big="A question that\nmakes you curious?")),
        (7.8, 14.6, dict(kicker="THE PART", big="3D-printed,\nlayer by layer")),
        (15.2, 22.2, dict(big=f"The key figure:\n{ACCENT}6.7 µN")),
        (22.8, 27.3, dict(kicker="THE RESULT", number="60", sub="frames per second", dy=80)),
        ("end", f"project\n{ACCENT}showcase", "The whole project in 3D", "example.paulasquin.com"),
    ],
}

for lang, items in TEXT.items():
    events = []
    for it in items:
        if it[0] == "end":
            events += ending(27.6, 30.0, it[1], it[2], it[3])
        else:
            events += block(it[0], it[1], **it[2])
    open(f"captions_{lang}.ass", "w").write(HEAD + "\n".join(events) + "\n")
    print(f"captions_{lang}.ass", len(events), "events")
