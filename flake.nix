# NITHEKY · flake — el stack completo, SIN Docker.
#
# Por qué nix y no docker (la decisión, no la moda): el Dockerfile que vivió
# aquí copiaba un .output dentro de una node:22-alpine — reproducible solo si
# uno confía en que el registry no cambió nada por debajo del lockfile. El
# flake congela las DOS capas: el toolchain (node, pnpm, postgres+postgis,
# nixpkgs por revisión de git, sellado en flake.lock) y las dependencias
# (pnpmDeps: un fixed-output derivation — si un paquete del lockfile cambia
# de contenido, el build rompe, no pasa desapercibido).
#
#   nix develop      → el entorno completo: node 22, pnpm 11.20, PostGIS 18
#   nix build        → el servidor Nitro (.output) como paquete con bin/
#   nix run          → arranca ese servidor: http://localhost:3000
#   nix flake check  → construye el paquete Y corre los 18 tests del motor
#
# Se construye y verifica en x86_64-linux (aquí y en el CI del repo). Añadir
# más sistemas es mecánico, pero cada uno exige su propia verificación — no
# se promete lo que no se corrió.
{
  description = "NITHEKY — same-direction matching · Nuxt 4 fullstack proof (country-neutral, reproducible)";

  # nixos-26.05 congelada por revisión; flake.lock la hace inmutable.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/cf9d2fb3e50fa1cd5114c47505ea9177f7ff5f49";

  outputs = { self, nixpkgs }:
    let
      buildSystems = [ "x86_64-linux" ];
      shellSystems = buildSystems ++ [ "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forSystems = systems: f: nixpkgs.lib.genAttrs systems (system: f system);

      node = pkgs: pkgs.nodejs_22;

      # La pnpm que instala y construye: la de nixpkgs (11.27, misma major,
      # mismo lockfile v9). Los humanos, en el dev shell, ejecutan la MISMA
      # 11.20.0 exacta que fija package.json y el CI — ver abajo.
      pnpmBuild = pkgs: pkgs.pnpm_11;

      # La MISMA pnpm que fija package.json y el CI (11.20.0), descargada del
      # tarball de npm con su hash: en nix no existe "la última versión".
      pnpmFijada = pkgs: pkgs.pnpm_11.override {
        version = "11.20.0";
        hash = "sha256-NOGYyx5DI3UX7O39MfmuJqbAo+U2bOWKLQX0sh+18Zo=";
      };
    in
    {
      # ── El entorno de desarrollo ────────────────────────────────────────
      devShells = forSystems shellSystems (system:
        let pkgs = nixpkgs.legacyPackages.${system}; in
        {
          default = pkgs.mkShell {
            packages = [
              (node pkgs)
              (pnpmFijada pkgs)
              # PostGIS 18 local sin docker: sql/pg.sh start lo levanta.
              (pkgs.postgresql_18.withPackages (p: [ p.postgis ]))
            ];
            shellHook = ''
              echo ""
              echo "  NITHEKY dev shell"
              echo "  node $(node --version | sed s/v//) · pnpm $(pnpm --version) · $(postgres --version)"
              echo ""
              echo "  PostGIS local:          sql/pg.sh start"
              echo "  todo el stack:          pnpm install && pnpm test && pnpm build"
              echo "  la prueba completa:     sql/comprobar.sh   (escenarios + carrera)"
              echo ""
            '';
          };
        });

      # ── El servidor Nitro como paquete ─────────────────────────────────
      packages = forSystems buildSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          # El store pnpm congelado — UNO solo, compartido por el paquete y
          # por los tests: mismo lockfile, misma verificación.
          deps = pkgs.fetchPnpmDeps {
            pname = "nitheky";
            src = self;
            pnpm = pnpmBuild pkgs;
            fetcherVersion = 4;
            # Hash del contenido de TODO el lockfile — si un solo paquete
            # cambia bajo el lockfile, este hash rompe el build (lo dictó
            # el propio nix en el primer build, como manda su manual).
            hash = "sha256-LbmxTeaGuM1LwpGd/IEXZIFj2ao5QnLpjJH8lc4fuSU=";
          };
          # El molde común del build pnpm: mismo store congelado (pnpmDeps),
          # mismo node, solo cambia lo que `pnpm run` ejecuta.
          molde = pkgs.stdenvNoCC.mkDerivation (finalAttrs: {
            pname = "nitheky";
            version = "2.0.0";
            src = self;

            nativeBuildInputs = [
              pkgs.pnpmConfigHook
              pkgs.pnpmBuildHook
              (pnpmBuild pkgs)
              (node pkgs)
            ];

            pnpmDeps = deps;

            env.NUXT_TELEMETRY_DISABLED = "1";
          });
        in
        rec {
          nitheky-web = molde.overrideAttrs (prevAttrs: {
            pname = "nitheky-web";
            # `pnpm run build` (lo que hace pnpmBuildHook por defecto):
            # nuxi build → .output, el servidor Nitro de producción.
            installPhase = ''
              runHook preInstall
              mkdir -p $out/share/nitheky $out/bin
              cp -r .output $out/share/nitheky/output
              cat > $out/bin/nitheky-web <<EOF
              #!/bin/sh
              # NITHEKY · el servidor Nitro construido por nix. Puerto: PORT o
              # NITRO_PORT (3000 por defecto). /api/salud dice qué hay vivo.
              exec ${node pkgs}/bin/node $out/share/nitheky/output/server/index.mjs
              EOF
              chmod +x $out/bin/nitheky-web
              runHook postInstall
            '';
            meta = {
              description = "NITHEKY proof — servidor Nitro (páginas + API) del motor de matching";
              mainProgram = "nitheky-web";
              license = nixpkgs.lib.licenses.mit;
              platforms = [ "x86_64-linux" ];
            };
          });
          default = nitheky-web;
        });

      # `nix run` arranca el servidor construido.
      apps = forSystems buildSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.nitheky-web}/bin/nitheky-web";
        };
      });

      # ── `nix flake check`: lo que se distribuye, verificado ────────────
      checks = forSystems buildSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          # El paquete se construye.
          nitheky-web = self.packages.${system}.nitheky-web;

          # Los 18 tests del motor, DENTRO del sandbox de nix: mismo lockfile,
          # mismo store congelado, mismo runner que el CI — pero por el canal
          # que distribuye el paquete.
          motor-18-tests = (self.packages.${system}.nitheky-web.overrideAttrs (prevAttrs: {
            pname = "nitheky-motor-tests";
            pnpmBuildScript = "test";
            # El tsconfig del repo extiende .nuxt/tsconfig.json, que genera
            # `nuxi prepare` — en el sandbox no existe porque .nuxt/ está
            # gitignored (el CI hace este mismo paso antes de lint).
            preBuild = ''
              pnpm exec nuxi prepare
            '';
            installPhase = "mkdir -p $out";
            meta = (prevAttrs.meta or { }) // {
              description = "NITHEKY proof — los 18 tests del motor, en el sandbox de nix";
            };
          }));
        });
    };
}
