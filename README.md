# Root Meter

Estimates the risk of severe maternal morbidity (PAS-SMM) and other complications for patients
having a cesarean hysterectomy for placenta accreta spectrum (PAS), built from the HCUP National
Inpatient Sample (NIS), 2016-2023. It assumes a cesarean hysterectomy is planned and does not
estimate whether one will be needed.

**Site:** https://bcmobgyn.github.io/root-meter/ (password required; ask the PAS research team).
The password is not case-sensitive.

## What is in this repository

Only the encrypted page and the tool that encrypts it. There is no data, no model output and
no analysis code here in readable form.

| File | Purpose |
|---|---|
| `index.html` | The published page: an unlock screen plus the Root Meter, encrypted |
| `gate.html` | Template for the unlock screen |
| `encrypt.mjs` | Encrypts a self-contained HTML page into `index.html` (Node 18+, no dependencies) |

The calculator is encrypted with AES-256-GCM under a key derived from the password
(PBKDF2-SHA256, 600,000 iterations, random salt and IV for every build) and is decrypted in
the visitor's browser. Treat the password as a way to keep the page among the team, not as
protection for confidential material: the encrypted file is public, so a short password could
be guessed offline. Nothing on the page is confidential. It shows only aggregate estimates,
and no figure rests on 10 or fewer records, per the HCUP Data Use Agreement.

"Remember on this device" keeps the decryption key (never the password) in the browser's local
storage. To forget it, open https://bcmobgyn.github.io/root-meter/?forget. Every rebuild
invalidates remembered keys.

## Rebuilding

```bash
# 1. Rebuild the plaintext calculator (in the analysis repository, not here)
Rscript 11_build_root_meter.R

# 2. Encrypt it; ROOTMETER_PASSWORD comes from .env (gitignored) or the environment
node encrypt.mjs <path to root_meter.html> --verify

# 3. Publish
git add index.html && git commit -m "Rebuild Root Meter" && git push
```

## Data and limits

Data: Healthcare Cost and Utilization Project (HCUP) National Inpatient Sample 2016-2023,
Agency for Healthcare Research and Quality. Estimates come from administrative claims. They
undercount complications, cannot see labs, imaging or the surgical team, and have not been
validated outside the NIS. The Root Meter is for counseling and research. It is not a
substitute for clinical judgment.

Its layout was inspired by the ACS NSQIP Surgical Risk Calculator. It uses no ACS data,
models or branding and is not affiliated with or endorsed by the American College of Surgeons.
