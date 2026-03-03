#!/usr/bin/env node

/**
 * 审查数据准备器
 * 将 Git 变更数据转换为适合审查的格式
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);

// --help 支持
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
审查数据准备器 - 将 Git 变更数据转换为审查格式

用法:
  node prepare-for-ai.js [选项]

选项:
  --input <file>   输入文件路径 (默认: changes.json)
  --output <file>  输出文件路径 (默认: review-data.json)
  --repo <path>    项目根目录路径 (默认: 输入文件所在目录)
  --help, -h       显示帮助信息

示例:
  node prepare-for-ai.js --input changes.json --output review-data.json
`);
  process.exit(0);
}

// 解析命令行参数
const params = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    params[key] = value;
    if (value !== true) i++;
  }
}

const inputFile = params.input || path.join(process.cwd(), 'changes.json');
const outputFile = params.output || path.join(process.cwd(), 'review-data.json');
const repoPath = params.repo || path.dirname(inputFile);

console.log(`[INFO] 准备审查数据...`);
console.log(`[INFO] 输入文件: ${inputFile}`);
console.log(`[INFO] 输出文件: ${outputFile}`);

if (!fs.existsSync(inputFile)) {
  console.error(`[ERROR] 输入文件不存在: ${inputFile}`);
  process.exit(1);
}

try {
  const changesData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  const reviewData = {
    metadata: {
      ...changesData.metadata,
      preparedAt: new Date().toISOString(),
    },
    summary: changesData.metadata.summary,
    files: [],
  };

  console.log(`[INFO] 处理 ${changesData.files.length} 个文件变更`);

  for (const file of changesData.files) {
    const filePath = path.join(repoPath, file.path);
    console.log(`[INFO]   ${file.path}`);

    const fileData = {
      path: file.path,
      commitHash: file.commitHash,
      changes: file.changes,
      additions: file.additions,
      deletions: file.deletions,
    };

    // 读取文件内容
    if (fs.existsSync(filePath)) {
      fileData.content = fs.readFileSync(filePath, 'utf8');
      fileData.size = fileData.content.length;
      fileData.lines = fileData.content.split('\n').length;
    } else {
      console.warn(`[WARN] 文件不存在: ${filePath}`);
      fileData.content = '';
      fileData.size = 0;
      fileData.lines = 0;
    }

    reviewData.files.push(fileData);
  }

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(reviewData, null, 2), 'utf8');
  console.log(`[OK] 审查数据已保存到: ${outputFile}`);
  console.log(`[INFO] 总计: ${reviewData.files.length} 个文件, ${reviewData.files.reduce((s, f) => s + f.lines, 0)} 行代码`);

} catch (error) {
  console.error('[ERROR] 准备失败:', error.message);
  process.exit(1);
}
