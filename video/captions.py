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
Style: Kicker,Kit Mono Medium,30,&H005EB4FF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,6,0,1,0,0,5,60,60,0,1
Style: Sub,Kit Inter Medium,38,&H00D3BFB4,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1
Style: Number,Kit Unbounded Medium,170,&H005EB4FF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,-4,0,1,0,0,5,60,60,0,1
Style: Title,Kit Unbounded Light,118,&H00F8EEE8,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,-4,0,1,0,0,5,60,60,0,1
Style: Url,Kit Mono Medium,36,&H005EB4FF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,60,60,0,1
Style: Shade,Arial,20,&H00000000,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

ACCENT = r"{\c&H5EB4FF&}"
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
        (0.4, 4.8, dict(kicker="QUÉBEC · ÉTÉ 2017", big="Un drone solaire\nqui se pose\nsur les lacs", dy=40)),
        (5.2, 9.6, dict(big="Il se pose\npour recharger")),
        (10.0, 12.3, dict(big=f"{ACCENT}3 h{WHITE} au soleil…\net le vent\nl'emporte")),
        (12.6, 14.8, dict(kicker="L'AILE", big="Taillée\nau fil chaud")),
        (15.1, 17.3, dict(big="Le moteur pivote,\nelle repart\nà la verticale")),
        (17.6, 19.8, dict(kicker="16 AOÛT 2017", big=f"Elle dérive à\n{ACCENT}5 %{WHITE} du vent")),
        (20.1, 22.3, dict(kicker="MON PROGRAMME", big="Trouver la place\nsur le lac")),
        (22.6, 24.8, dict(big="Se poser au vent,\ndériver à l'abri")),
        (25.1, 27.3, dict(kicker="L'ANCRE", number="30 s", sub="pour la déployer", dy=80)),
        ("end", f"prévoir\n{ACCENT}la dérive", "Tout le projet en 3D", "suwave.paulasquin.com"),
    ],
    "en": [
        (0.4, 4.8, dict(kicker="QUÉBEC · SUMMER 2017", big="A solar drone\nthat lands\non lakes", dy=40)),
        (5.2, 9.6, dict(big="It lands\nto recharge")),
        (10.0, 12.3, dict(big=f"{ACCENT}3 h{WHITE} in the sun…\nwhile the wind\npushes it away")),
        (12.6, 14.8, dict(kicker="THE WING", big="Cut with\na hot wire")),
        (15.1, 17.3, dict(big="The motor tilts,\nit lifts off\nvertically")),
        (17.6, 19.8, dict(kicker="16 AUGUST 2017", big=f"It drifts at\n{ACCENT}5%{WHITE} of the wind")),
        (20.1, 22.3, dict(kicker="MY PROGRAM", big="Finding room\non the lake")),
        (22.6, 24.8, dict(big="Land upwind,\ndrift in safety")),
        (25.1, 27.3, dict(kicker="THE ANCHOR", number="30 s", sub="to deploy it", dy=80)),
        ("end", f"predict\n{ACCENT}the drift", "The whole project in 3D", "suwave.paulasquin.com"),
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
