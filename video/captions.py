"""Write the on-screen text (ASS) of the 40 s vertical video, in French and English.

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
        out += line(start + 0.18, end, "Sub", sub.replace("\n", r"\N"), y + (120 if big and "\n" in big else 90) + (22 if "\n" in sub else 0) if big else y, rise=24)
    return out


def ending(start, end, title, sub, url):
    shade = rf"{{\an7\pos(0,0)\fad(500,0)\1a&H50&\p1}}m 0 0 l 1080 0 l 1080 1920 l 0 1920{{\p0}}"
    out = [f"Dialogue: 0,{ts(start)},{ts(end)},Shade,,0,0,0,,{shade}"]
    out += line(start + 0.15, end, "Title", title.replace("\n", r"\N"), 1040, rise=50, fade=(400, 0))
    out += line(start + 0.45, end, "Sub", sub, 1265, rise=24, fade=(300, 0))
    out += line(start + 0.65, end, "Url", url, 1335, rise=20, fade=(300, 0))
    return out


# One entry per text block: (start, end, dict(kicker=, big=, sub=, number=, dy=)), then the end card
# ("end", title, subtitle, url). Keep big lines under ~17 characters (Unbounded is wide); "\n"
# breaks a line (sub included). ACCENT colours what follows; WHITE switches back.
END = 35.4
TEXT = {
    "fr": [
        (0.4, 5.9, dict(kicker="QUÉBEC · ÉTÉ 2017", big="Une aile solaire\nqui se pose\nsur les lacs", dy=40)),
        (7.6, 9.9, dict(big="Trois heures\nau soleil\npour recharger")),
        (10.1, 12.3, dict(big="Mais le vent\nla pousse\nvers la berge")),
        (12.6, 16.0, dict(kicker="MESURER · 16 AOÛT 2017", big="Trois ailes\nlivrées au vent", sub="suivies au GPS, seconde par seconde")),
        (16.3, 19.8, dict(kicker="VITESSE DE DÉRIVE", number="5 %", sub="de la vitesse du vent", dy=80)),
        (20.1, 22.3, dict(kicker="PRÉDIRE", big="Les prévisions\nde vent", sub="un vecteur toutes les trois heures")),
        (22.6, 24.8, dict(big=f"{ACCENT}5 %{WHITE} × vent × durée", sub="mis bout à bout,\nles vecteurs tracent la dérive")),
        (25.1, 29.8, dict(kicker="290 ZONES D'EAU LIBRE", big="Choisir celle\nqui contient\nla dérive")),
        (30.1, 34.8, dict(kicker="LE POINT DE POSE", big="Se poser au vent", sub="et dériver trois heures\nsans atteindre la berge")),
        ("end", f"prévoir\n{ACCENT}la dérive", "Tout le projet, en 3D", "suwave.paulasquin.com"),
    ],
    "en": [
        (0.4, 5.9, dict(kicker="QUÉBEC · SUMMER 2017", big="A solar wing\nthat lands\non lakes", dy=40)),
        (7.6, 9.9, dict(big="Three hours\nin the sun\nto recharge")),
        (10.1, 12.3, dict(big="But the wind\npushes it\ntowards the shore")),
        (12.6, 16.0, dict(kicker="MEASURE · 16 AUGUST 2017", big="Three wings\nset adrift", sub="tracked by GPS, second by second")),
        (16.3, 19.8, dict(kicker="DRIFT SPEED", number="5%", sub="of the wind speed", dy=80)),
        (20.1, 22.3, dict(kicker="PREDICT", big="The wind\nforecast", sub="one vector every three hours")),
        (22.6, 24.8, dict(big=f"{ACCENT}5%{WHITE} × wind × time", sub="placed head to tail,\nthe vectors trace the drift")),
        (25.1, 29.8, dict(kicker="290 PATCHES OF OPEN WATER", big="Pick the one\nthat holds\nthe drift")),
        (30.1, 34.8, dict(kicker="THE LANDING POINT", big="Land upwind", sub="and drift for three hours\nwithout reaching the shore")),
        ("end", f"predict\n{ACCENT}the drift", "The whole project, in 3D", "suwave.paulasquin.com"),
    ],
}

for lang, items in TEXT.items():
    events = []
    for it in items:
        if it[0] == "end":
            events += ending(END, 40.0, it[1], it[2], it[3])
        else:
            events += block(it[0], it[1], **it[2])
    open(f"captions_{lang}.ass", "w").write(HEAD + "\n".join(events) + "\n")
    print(f"captions_{lang}.ass", len(events), "events")
