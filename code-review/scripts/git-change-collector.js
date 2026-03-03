#!/usr/bin/env node

/**
 * Git 变更收集器
 * 收集指定时间范围内的 Git 变更，生成结构化的变更数据
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// --help 支持
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Git 变更收集器 - 收集 Git 仓库变更数据

用法:
  node git-change-collector.js [选项]

选项:
  --source <path>  Git 仓库路径 (默认: 当前目录)
  --output <file>  输出文件路径 (默认: changes.json)
  --mode <mode>    收集模式:
                     all     - 所有提交
                     last:N  - 最近N次提交
                     diff    - 工作区未提交变更
  --help, -h       显示帮助信息

示例:
  node git-change-collector.js --source ./my-project --mode last:5
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

// 必需参数
const sourcePath = params.source || process.cwd();
const outputPath = params.output || path.join(process.cwd(), 'changes.json');
const mode = params.mode || 'all'; // all, last:N, diff

console.log(`[INFO] 开始收集 Git 变更...`);
console.log(`[INFO] 源路径: ${sourcePath}`);
console.log(`[INFO] 输出文件: ${outputPath}`);
console.log(`[INFO] 模式: ${mode}`);

try {
  let commits = [];

  if (mode.startsWith('last:')) {
    const count = parseInt(mode.split(':')[1], 10);
    console.log(`[INFO] 收集最近 ${count} 次提交`);
    commits = getLastCommits(sourcePath, count);
  } else if (mode === 'diff') {
    console.log(`[INFO] 收集工作区变更 (diff HEAD)`);
    commits = getWorkingTreeChanges(sourcePath);
  } else {
    console.log(`[INFO] 收集所有提交`);
    commits = getAllCommits(sourcePath);
  }

  const files = collectFilesFromCommits(commits, sourcePath);

  const result = {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourcePath,
      mode,
      summary: {
        commits: commits.length,
        files: files.length,
        totalAdditions: files.reduce((sum, f) => sum + (f.additions || 0), 0),
        totalDeletions: files.reduce((sum, f) => sum + (f.deletions || 0), 0),
      },
    },
    commits,
    files,
  };

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`[OK] 变更数据已保存到: ${outputPath}`);
  console.log(`[INFO] 总计: ${commits.length} 次提交, ${files.length} 个文件变更`);

} catch (error) {
  console.error('[ERROR] 收集失败:', error.message);
  process.exit(1);
}

function getAllCommits(repoPath) {
  const output = execSync(
    'git log --all --pretty=format:"%H|%ai|%s|%an" --date=iso',
    { cwd: repoPath, encoding: 'utf8' }
  );

  return output.trim().split('\n').map(line => {
    const [hash, date, message, author] = line.split('|');
    return { hash, date, message, author };
  });
}

function getLastCommits(repoPath, count) {
  const output = execSync(
    `git log -${count} --pretty=format:"%H|%ai|%s|%an" --date=iso`,
    { cwd: repoPath, encoding: 'utf8' }
  );

  return output.trim().split('\n').map(line => {
    const [hash, date, message, author] = line.split('|');
    return { hash, date, message, author };
  });
}

function getWorkingTreeChanges(repoPath) {
  return [{
    hash: 'WORKING_TREE',
    date: new Date().toISOString(),
    message: '工作区未提交变更',
    author: 'Current User',
  }];
}

function collectFilesFromCommits(commits, repoPath) {
  const files = [];
  const seenFiles = new Set();

  for (const commit of commits) {
    try {
      let output;

      if (commit.hash === 'WORKING_TREE') {
        // 工作区变更使用 git diff
        output = execSync('git diff --numstat', { cwd: repoPath, encoding: 'utf8' });
      } else {
        // 使用 git diff-tree 获取单次提交的变更
        try {
          output = execSync(`git diff-tree --no-commit-id --numstat -r ${commit.hash}`, { cwd: repoPath, encoding: 'utf8' });
        } catch (diffError) {
          // 如果 diff-tree 失败，尝试使用 diff-parent
          try {
            output = execSync(`git diff --numstat ${commit.hash}^..${commit.hash}`, { cwd: repoPath, encoding: 'utf8' });
          } catch (diffError2) {
            // 如果还是失败，使用 git show --name-status
            const nameStatus = execSync(`git show --name-status --format="" ${commit.hash}`, { cwd: repoPath, encoding: 'utf8' });
            for (const line of nameStatus.trim().split('\n')) {
              if (!line) continue;
              const parts = line.split('\t');
              if (parts.length < 2) continue;
              const filePath = parts[1];

              const fileKey = `${commit.hash}:${filePath}`;
              if (seenFiles.has(fileKey)) continue;
              seenFiles.add(fileKey);

              files.push({
                path: filePath,
                commitHash: commit.hash,
                additions: 0,
                deletions: 0,
                changes: 0,
              });
            }
            continue;
          }
        }
      }

      for (const line of output.trim().split('\n')) {
        if (!line) continue;

        const parts = line.split('\t');
        if (parts.length < 3) continue;

        const additions = parseInt(parts[0], 10) || 0;
        const deletions = parseInt(parts[1], 10) || 0;
        const filePath = parts[2];

        const fileKey = `${commit.hash}:${filePath}`;
        if (seenFiles.has(fileKey)) continue;
        seenFiles.add(fileKey);

        files.push({
          path: filePath,
          commitHash: commit.hash,
          additions,
          deletions,
          changes: additions + deletions,
        });
      }
    } catch (error) {
      if (commit.hash !== 'WORKING_TREE') {
        console.warn(`[WARN] 无法收集提交 ${commit.hash} 的文件: ${error.message}`);
      }
    }
  }

  return files;
}
