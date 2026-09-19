# Changelog

## [0.0.12](https://github.com/maschina-labs/maschina/compare/v0.0.11...v0.0.12) (2026-09-19)


### Added

* **db:** reserve budget before signing and settle after ([#518](https://github.com/maschina-labs/maschina/issues/518)) ([c92501b](https://github.com/maschina-labs/maschina/commit/c92501b7bff99bf5dd645a828262c1098e5129e3))
* **signer:** never submit the same trade twice ([#521](https://github.com/maschina-labs/maschina/issues/521)) ([c11d8a3](https://github.com/maschina-labs/maschina/commit/c11d8a383f7263f0c1544f04a900c20a04c42494))
* **signer:** sign through turnkey with its policy enforced ([#519](https://github.com/maschina-labs/maschina/issues/519)) ([73bbe28](https://github.com/maschina-labs/maschina/commit/73bbe28b7ff274b8092adee1c677ad6ac407c418))
* **solana:** bid to land trades, never past the cap ([#522](https://github.com/maschina-labs/maschina/issues/522)) ([3d47b46](https://github.com/maschina-labs/maschina/commit/3d47b462b973f5bb4c58c928b33658e2a380a1f3))
* **web:** a plain test landing page, and a README for judges ([#537](https://github.com/maschina-labs/maschina/issues/537)) ([ef6c570](https://github.com/maschina-labs/maschina/commit/ef6c5702ea275b5e6df8b1a21affc79eeff28989))
* **web:** use the maschina mark and wordmark ([#538](https://github.com/maschina-labs/maschina/issues/538)) ([3716833](https://github.com/maschina-labs/maschina/commit/371683375bc3e262db041e792924ded5c88a792c))

## [0.0.11](https://github.com/maschina-labs/maschina/compare/v0.0.10...v0.0.11) (2026-09-18)


### Added

* **signer:** accept proposed transactions from the orchestrator only ([#515](https://github.com/maschina-labs/maschina/issues/515)) ([228aa0f](https://github.com/maschina-labs/maschina/commit/228aa0f1b07d0f0cf6a70effa4d8e884e8438604))
* **signer:** check Maschina's rules before every signature ([#517](https://github.com/maschina-labs/maschina/issues/517)) ([352d63f](https://github.com/maschina-labs/maschina/commit/352d63f0db6c9519860fa460e18b6f24e111dd21))

## [0.0.10](https://github.com/maschina-labs/maschina/compare/v0.0.9...v0.0.10) (2026-09-18)


### Added

* **solana:** add raydium as a second router ([#514](https://github.com/maschina-labs/maschina/issues/514)) ([855992c](https://github.com/maschina-labs/maschina/commit/855992c877714a94553d595721bf15e1b240b60d))
* **solana:** build swap transactions from quotes ([#512](https://github.com/maschina-labs/maschina/issues/512)) ([2282586](https://github.com/maschina-labs/maschina/commit/22825866c2d379fa52b6628e779c6838ff5e9c08))
* **solana:** check quotes against an independent price ([#510](https://github.com/maschina-labs/maschina/issues/510)) ([374d0da](https://github.com/maschina-labs/maschina/commit/374d0dae5623b3a43786ac2166e1c2d9ba1dc090))
* **solana:** confirm transactions and check whether they landed ([#513](https://github.com/maschina-labs/maschina/issues/513)) ([afeea6c](https://github.com/maschina-labs/maschina/commit/afeea6c16a7da7cbc4897a5bb0a1ecbc61fffb30))
* **solana:** get swap quotes from Jupiter ([#509](https://github.com/maschina-labs/maschina/issues/509)) ([560c06a](https://github.com/maschina-labs/maschina/commit/560c06aa7463373644926b7ad299efe5b1856bfc))
* **solana:** read token mints and wallet balances ([#507](https://github.com/maschina-labs/maschina/issues/507)) ([59985ac](https://github.com/maschina-labs/maschina/commit/59985ac093130ccd534b4ef9d117acde4e94987d))

## [0.0.9](https://github.com/maschina-labs/maschina/compare/v0.0.8...v0.0.9) (2026-09-18)


### Added

* **runtime:** classify failures and recover by effect class ([#474](https://github.com/maschina-labs/maschina/issues/474)) ([45d628b](https://github.com/maschina-labs/maschina/commit/45d628b7d7de06531009a4021152903ea36c8da5))
* **runtime:** run every machine kind through one interface ([#471](https://github.com/maschina-labs/maschina/issues/471)) ([78acf9b](https://github.com/maschina-labs/maschina/commit/78acf9b6dfef31b62e18de262c45b7b6be7ed3a9))
* **runtime:** run the eight steps of a run in order ([#473](https://github.com/maschina-labs/maschina/issues/473)) ([657bb15](https://github.com/maschina-labs/maschina/commit/657bb1549e06cd18a9e57708b2d269369c137a84))

## [0.0.8](https://github.com/maschina-labs/maschina/compare/v0.0.7...v0.0.8) (2026-09-18)


### Added

* **db:** store machines with their owner, wallet and pinned version ([#468](https://github.com/maschina-labs/maschina/issues/468)) ([5767bd1](https://github.com/maschina-labs/maschina/commit/5767bd19a97ea11676cb391963a797177f0293b3))

## [0.0.7](https://github.com/maschina-labs/maschina/compare/v0.0.6...v0.0.7) (2026-09-18)


### Added

* **db:** store owners and machine definitions ([#466](https://github.com/maschina-labs/maschina/issues/466)) ([a01185a](https://github.com/maschina-labs/maschina/commit/a01185a33483e3731776b6f81d2ee8697f544846))

## [0.0.6](https://github.com/maschina-labs/maschina/compare/v0.0.5...v0.0.6) (2026-09-17)


### Added

* **db:** write every event through one function ([#464](https://github.com/maschina-labs/maschina/issues/464)) ([f94e89f](https://github.com/maschina-labs/maschina/commit/f94e89f52dc2b44f2a95f75cd0d26f83c4f3fec2))

## [0.0.5](https://github.com/maschina-labs/maschina/compare/v0.0.4...v0.0.5) (2026-09-17)


### Added

* **contracts:** define the record's event types ([#462](https://github.com/maschina-labs/maschina/issues/462)) ([2ea5998](https://github.com/maschina-labs/maschina/commit/2ea5998ebe363eefd5d13588af855812edfa69f0))

## [0.0.4](https://github.com/maschina-labs/maschina/compare/v0.0.3...v0.0.4) (2026-09-17)


### Added

* **db:** create the append-only record table ([#461](https://github.com/maschina-labs/maschina/issues/461)) ([2a229ff](https://github.com/maschina-labs/maschina/commit/2a229fffb9283ecdf681730220058c0ae9956692))
* **repo:** read mainnet and devnet balances through helius ([#458](https://github.com/maschina-labs/maschina/issues/458)) ([1016be3](https://github.com/maschina-labs/maschina/commit/1016be353237a2bbc4b02793ab0793bd023482cd))
* **signer:** define the wallet provider interface ([#457](https://github.com/maschina-labs/maschina/issues/457)) ([5195659](https://github.com/maschina-labs/maschina/commit/5195659eb2332dff91f6ae63871f4857fd013c07))

## [0.0.3](https://github.com/maschina-labs/maschina/compare/v0.0.2...v0.0.3) (2026-09-17)


### Added

* **repo:** create the crossmint wallet in the spike ([#448](https://github.com/maschina-labs/maschina/issues/448)) ([b04ba65](https://github.com/maschina-labs/maschina/commit/b04ba65a03a73da527765e0f2a2df21eb41efcde))
* **repo:** prove turnkey refuses what the policy forbids ([0b7d3b4](https://github.com/maschina-labs/maschina/commit/0b7d3b4e7d7939d115bae2027759578736992486))
* **repo:** run the refusal checks against crossmint ([#450](https://github.com/maschina-labs/maschina/issues/450)) ([79cefa6](https://github.com/maschina-labs/maschina/commit/79cefa6cb44b3fb2f9169033b95e689bfc3602f0))
* **repo:** scope the machine signer on the crossmint wallet ([93308e3](https://github.com/maschina-labs/maschina/commit/93308e3a3845ec74fabb23bb21c5f8a4a497b619))
* **repo:** test approved recipients on both providers ([#455](https://github.com/maschina-labs/maschina/issues/455)) ([471a84c](https://github.com/maschina-labs/maschina/commit/471a84cd05f476c357cf11d3760c2ea13de8c0d3))


### Fixed

* **daemon:** give the concurrent identity test its own time limit ([#454](https://github.com/maschina-labs/maschina/issues/454)) ([d055ffa](https://github.com/maschina-labs/maschina/commit/d055ffa5e17f7028c6e6e23f206aa7891f4219e8))

## [0.0.2](https://github.com/maschina-labs/maschina/compare/v0.0.1...v0.0.2) (2026-09-17)


### Added

* **repo:** add the wallet provider spike ([#440](https://github.com/maschina-labs/maschina/issues/440)) ([e4168bf](https://github.com/maschina-labs/maschina/commit/e4168bfb4ec3136fe52418fa9a58dcc921dd2fb0))
* **repo:** attach the machine wallet policy in turnkey ([9f32ecb](https://github.com/maschina-labs/maschina/commit/9f32ecb4ee0efa0a4a488aacaea3b1efaede469e))


### Fixed

* **core:** refuse overlong amounts ([25309c9](https://github.com/maschina-labs/maschina/commit/25309c9bbb4fd22e8035aa1c9ccde3190579f354))
* **daemon:** check and read the identity from one handle ([fefcaef](https://github.com/maschina-labs/maschina/commit/fefcaef9e79efde21f387a7f506e7f955f197c32))
* **daemon:** skip the unreadable file test as root ([#430](https://github.com/maschina-labs/maschina/issues/430)) ([d9cb3f3](https://github.com/maschina-labs/maschina/commit/d9cb3f3e627e82091624c5870b8a9e2b056cb06a))
* **gateway:** rate limit on the gateway's clock ([#429](https://github.com/maschina-labs/maschina/issues/429)) ([a479352](https://github.com/maschina-labs/maschina/commit/a479352dd022e62a9549d1c217e4a41a6b265191))

## 0.0.1 (2026-09-16)


### Added

* **repo:** set up the repository ([c6edac2](https://github.com/maschina-labs/maschina/commit/c6edac22639908cbac0c2307f0ab63e42f2731e2))


### Fixed

* **release:** start the first release at 0.0.1 ([#5](https://github.com/maschina-labs/maschina/issues/5)) ([ddcc592](https://github.com/maschina-labs/maschina/commit/ddcc5923e379059442fc6a7b26a71741d32707d5))

## Changelog

Every release of Maschina, newest first. Entries come from the titles of the pull requests in each
release.
