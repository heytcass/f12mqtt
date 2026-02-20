{
  description = "f12mqtt — F1 Live Timing → MQTT Bridge";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f {
        pkgs = import nixpkgs { inherit system; };
      });
    in
    {
      devShells = forAllSystems ({ pkgs }: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            nodePackages.npm

            # Native deps for better-sqlite3
            python3
            pkg-config
          ];

          shellHook = ''
            echo "f12mqtt dev shell — node $(node --version)"
          '';
        };
      });
    };
}
