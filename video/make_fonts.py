"""Static instances of the site's variable fonts, with unique family names libass can match."""
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
for src, wght, fam, extra in [("Unbounded", 500, "Kit Unbounded Medium", {}), ("Unbounded", 300, "Kit Unbounded Light", {}),
                              ("Inter", 500, "Kit Inter Medium", {"opsz": 32}), ("JetBrainsMono", 500, "Kit Mono Medium", {})]:
    f = TTFont(f"fonts/{src}.ttf")
    axes = {"wght": wght, **extra}
    inst = instantiateVariableFont(f, axes, updateFontNames=False)
    name = inst["name"]
    for rec in list(name.names):
        if rec.nameID in (16, 17, 21, 22, 25): name.removeNames(nameID=rec.nameID)
    for nid, val in ((1, fam), (2, "Regular"), (4, fam), (6, fam.replace(" ", ""))):
        name.setName(val, nid, 3, 1, 0x409); name.setName(val, nid, 1, 0, 0)
    inst.save(f"fonts/static/{fam.replace(' ', '')}.ttf")
    print(fam)
