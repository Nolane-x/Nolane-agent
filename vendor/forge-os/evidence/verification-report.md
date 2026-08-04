# ForgeOS 0.6.1 Verification Report

- **Status:** pass
- **Source mode:** git
- **Source manifest:** `1cc40a16713a56dc9e2284660b1e230c0004eaf4ac0177194627abfbe0f56042` (2305 files)
- **Source commit:** `42c3b4a0fbdc7a4d5fc6f5e64a9d8f39afaba749`
- **Dirty before verification:** no
- **Tests:** 388/388 passed; 0 failed
- **Coverage:** 97.64% lines · 74.75% branches · 93.91% functions
- **Evidence-qualified stable skills:** 0
- **Certified skills:** 0
- **Critical mutation matrix:** 7/7 killed

## Commands

- `npm run generate:capabilities` — exit 0, 133 ms, output `76682fb0e37c5faec1ae2d145cbd8827a99fa0fe025d075eadcdb50c00563cec`
- `npm run generate:knowledge` — exit 0, 131 ms, output `e734bf66564ddd948fa4557969e575da1706274862801df585acd83a0e0dc9b4`
- `npm run generate:v06` — exit 0, 2186 ms, output `5d382ef96d75feb57e3d015c0d5c6e7ddfd15c415e042c1d8efcb93650ef856b`
- `npm run v06:audit` — exit 0, 308 ms, output `d5230b7642596d12a401a5afa6553fe6c40a238576bd1a1b0953f8665d3ec552`
- `npm run skills:v2:audit` — exit 0, 280 ms, output `62a68400e57f95bc386d4346d1c4cb27ee3641d5688f1e0c57783aac5eddc591`
- `npm run skills:certification-audit` — exit 0, 204 ms, output `c853dbc403b8417b50ee6236f66be4f59979cfc28fed923f20817c027441869e`
- `npm run test:mutation-critical` — exit 0, 5107 ms, output `f3a68d93e8ba2e6507f9d5146300715a5429a155489ce4b8f2d7a855da4541be`
- `npm run router:benchmark` — exit 0, 611 ms, output `614f22d8e467b395f300252dd4ffe0f5a2b568ea9c571ea1525bed8aa3e6435c`
- `npm run context:benchmark` — exit 0, 221 ms, output `1339fa01b740b731e8ed26e7d29949369b8e1aa7795428a3f628e297880b5531`
- `npm run federation:eval` — exit 0, 161 ms, output `54ab9a5cc23ad752ebae1aa2526f7ee6dde8a35327de0f7cd051a4a540bafd7d`
- `npm run federation:audit` — exit 0, 299 ms, output `4e804aef13f2dbfb1ddce90e885208ae44c07565e14ea0ccef368dcff93a489e`
- `npm test` — exit 0, 13993 ms, output `ba85560cd4ffab93eacefad4b959397c03c0864f18d26200c3311c55c1ea894a`
- `npm run lint:syntax` — exit 0, 3283 ms, output `18787d4d5540af058543960aee995c760d945fdb758169ef980366c995a1e41c`
- `npm run lint:json` — exit 0, 287 ms, output `63e5f25303cc7fe2cbdac4134af09d6cff7b7f217051b52d190b32ff512d84b7`
- `npm run lint:docs` — exit 0, 304 ms, output `bc26963affe197b14b680c9a6b23b6499d2b56dcf1b5149033133870b4db9adf`
- `npm run lint:skills` — exit 0, 148 ms, output `a1a408d56f994f5ee5bda915a1ce30e539bcbe1b22c6d8b943fc825399c4098b`
- `npm run lint:adapters` — exit 0, 103 ms, output `65fd1317d4839b93ed29a8ac06a5fc6c955384d525c19d4ef25d95d8f39c025a`
- `npm run smoke` — exit 0, 502 ms, output `51dea2f8730227393cc26b8fc25416e735dd3dce9bc0d0f2c6a81b17c954e90f`
- `npm run adapter:tck` — exit 0, 679 ms, output `faaca43bb76b70947668c9d9193aa9c0c7b2a6a58564b600c0eaa1732d123015`
- `npm run test:coverage` — exit 0, 13861 ms, output `f9161df341f4ae194b13e3c13e20792a1550f9897597f1198b6cfe017dd68e66`
- `node scripts/capture-dashboard.mjs` — exit 0, 787 ms, output `7eb6443209d878d7d7a53b4107f3c3423e267cecd9f82755b33cdac9b7a3ad27`

## Claims boundary

This report proves only the source-manifest digest and commands recorded in this run. It does not prove defect-free software, external vendor certification, or environments outside the tested matrix.
