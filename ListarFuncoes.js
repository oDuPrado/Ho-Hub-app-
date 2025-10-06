// listarFuncoes.js
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const IGNORE_DIRS = ["node_modules", ".expo", "dist", "build", ".next"];
const RESULT = [];

// 🧭 varre diretórios recursivamente
function scanDir(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    // Ignora pastas inúteis
    if (stat.isDirectory()) {
      if (IGNORE_DIRS.some(d => full.includes(d))) {
        continue;
      }
      scanDir(full);
      continue;
    }

    // Analisa arquivos de código
    if (EXTENSIONS.some(ext => full.endsWith(ext))) {
      const code = fs.readFileSync(full, "utf8");

      // Captura funções normais, async e arrow
      const matches = [
        ...code.matchAll(/function\s+([a-zA-Z0-9_]+)/g),
        ...code.matchAll(/const\s+([a-zA-Z0-9_]+)\s*=\s*.*=>/g),
        ...code.matchAll(/async\s+function\s+([a-zA-Z0-9_]+)/g)
      ];

      if (matches.length > 0) {
        RESULT.push({
          file: path.relative(ROOT, full),
          functions: matches.map(m => m[1])
        });
      }
    }
  }
}

// 🔍 Função segura que só varre se a pasta existir
function safeScan(subdir) {
  const dir = path.join(ROOT, subdir);
  if (fs.existsSync(dir)) {
    scanDir(dir);
  } else {
    console.log(`⚠️  Pasta ignorada: ${subdir} (não existe)`);
  }
}

// 🚀 Executa nas principais pastas do Expo
safeScan("app");
safeScan("components");
safeScan("src");
safeScan("lib");

// 💾 Gera o relatório final
fs.writeFileSync("funcoes.json", JSON.stringify(RESULT, null, 2));
console.log(`✅ funcoes.json gerado com sucesso!
Total de arquivos analisados: ${RESULT.length}`);
