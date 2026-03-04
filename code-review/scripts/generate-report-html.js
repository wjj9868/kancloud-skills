#!/usr/bin/env node

/**
 * HTML 报告生成器
 * 支持行格式和JSON格式输入
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// --help 支持
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
HTML 报告生成器 - 将审查结果转换为 HTML 报告

用法:
  node generate-report-html.js [选项]

选项:
  --input <file>   输入文件路径 (默认: ai-review-result.txt)
  --output <file>  输出 HTML 文件路径 (默认: review-report.html)
  --help, -h       显示帮助信息

输入格式:
  行格式: type§severity§title§location§description§code§fix
  JSON格式: 自动检测

示例:
  node generate-report-html.js --input result.txt --output report.html
`);
    process.exit(0);
}

const params = {};
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
        // 支持 --key=value 格式
        if (args[i].includes('=')) {
            const [key, ...valueParts] = args[i].slice(2).split('=');
            params[key] = valueParts.join('=');
        } else {
            // 支持 --key value 格式
            const key = args[i].slice(2);
            const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
            params[key] = value;
            if (value !== true) i++;
        }
    }
}

// 获取脚本所在目录
const scriptDir = __dirname;
const skillRootDir = path.resolve(scriptDir, '..');

// 输入文件路径：优先使用绝对路径，否则在 Skill 根目录下查找
const inputFile = params.input 
    ? (path.isAbsolute(params.input) ? params.input : path.join(process.cwd(), params.input))
    : path.join(skillRootDir, 'ai-review-result.txt');

// 输出文件路径：优先使用绝对路径，否则在当前工作目录输出
const outputFile = params.output
    ? (path.isAbsolute(params.output) ? params.output : path.join(process.cwd(), params.output))
    : path.join(process.cwd(), 'review-report.html');

console.log(`[INFO] 生成 HTML 报告...`);
console.log(`[INFO] 输入文件: ${inputFile}`);
console.log(`[INFO] 输出文件: ${outputFile}`);

if (!fs.existsSync(inputFile)) {
    console.error(`[ERROR] 输入文件不存在: ${inputFile}`);
    process.exit(1);
}

/**
 * 解析行格式为 JSON
 * 格式: type§severity§title§location§description§code§fix
 * META行: META§文件数§总行数
 */
function parseLineFormat(content) {
    const lines = content.trim().split('\n').filter(line => line.trim());
    const severityMap = { '1': 'critical', '2': 'warning', '3': 'info' };

    let metadata = { reviewedAt: new Date().toISOString(), filesReviewed: 0, totalLines: 0 };
    const issues = [];

    for (const line of lines) {
        const parts = line.split('§');

        if (parts[0] === 'META' && parts.length >= 3) {
            metadata.filesReviewed = parseInt(parts[1], 10) || 0;
            metadata.totalLines = parseInt(parts[2], 10) || 0;
            continue;
        }

        // 跳过无效行：字段不足7个，或包含占位符（type/title/location等示例值）
        if (parts.length >= 7) {
            const type = parts[0];
            const title = parts[2];
            const location = parts[3];
            
            // 跳过占位符行（示例行）
            if (type === 'type' || title === 'title' || location === 'location' ||
                type === 'TYPE' || title === 'TITLE' || location === 'LOCATION') {
                console.log(`[WARN] 跳过占位符行: ${line.substring(0, 50)}...`);
                continue;
            }
            
            // 跳过表头行
            if (type.toLowerCase().includes('type') && title.toLowerCase().includes('title')) {
                console.log(`[WARN] 跳过表头行: ${line.substring(0, 50)}...`);
                continue;
            }
            
            issues.push({
                type: type,
                severity: severityMap[parts[1]] || parts[1],
                title: title,
                location: location,
                description: parts[4],
                code: parts[5],
                fix: parts[6],
                flowchart: parts[7] || null
            });
        }
    }

    return {
        metadata,
        summary: {
            totalIssues: issues.length,
            criticalCount: issues.filter(i => i.severity === 'critical').length,
            warningCount: issues.filter(i => i.severity === 'warning').length,
            infoCount: issues.filter(i => i.severity === 'info').length
        },
        issues
    };
}

/**
 * 自动检测输入格式并解析
 */
function parseInput(content) {
    const trimmed = content.trim();
    // 如果以 { 或 [ 开头，认为是 JSON 格式
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(content);
    }
    // 否则认为是行格式
    return parseLineFormat(content);
}

try {
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    const reviewData = parseInput(fileContent);
    console.log(`[INFO] 解析到 ${reviewData.issues?.length || 0} 个问题`);
    const html = generateHTMLReport(reviewData);

    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputFile, html, 'utf8');
    console.log(`[OK] HTML 报告已保存到: ${outputFile}`);
} catch (error) {
    console.error('[ERROR] 生成失败:', error.message);
    process.exit(1);
}

function generateHTMLReport(data) {
    const { metadata, summary, issues } = data;

    const severityStats = {
        critical: issues ? issues.filter(i => i.severity === 'critical').length : 0,
        warning: issues ? issues.filter(i => i.severity === 'warning').length : 0,
        info: issues ? issues.filter(i => i.severity === 'info').length : 0
    };

    // 收集所有包含流程图的问题
    const flowchartIssues = issues ? issues.filter(i => i.flowchart) : [];
    const hasFlowcharts = flowchartIssues.length > 0;

    const issuesByType = issues ? groupIssuesByType(issues) : {};
    const issuesJson = JSON.stringify(issues || []);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CODE REVIEW // SYSTEM ANALYSIS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&family=Syncopate:wght@400;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        :root {
            --bg-primary: #0a0a0f;
            --bg-secondary: #12121a;
            --bg-card: #1a1a25;
            --bg-code: #0d0d12;
            --bg-hover: #252535;
            
            --neon-cyan: #00f5d4;
            --neon-pink: #ff006e;
            --neon-purple: #8338ec;
            --neon-yellow: #ffbe0b;
            --neon-red: #fb5607;
            --neon-blue: #3a86ff;
            
            --text-primary: #f0f0f5;
            --text-secondary: #a0a0b0;
            --text-muted: #606070;
            --text-accent: #00f5d4;
            
            --border-subtle: rgba(255, 255, 255, 0.06);
            --border-glow: rgba(0, 245, 212, 0.3);
            
            --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.4);
            --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.5);
            --shadow-glow: 0 0 30px rgba(0, 245, 212, 0.15);
            
            --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
            --ease-in-out-circ: cubic-bezier(0.85, 0, 0.15, 1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html {
            scroll-behavior: smooth;
        }

        body {
            font-family: 'Space Grotesk', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            font-size: 15px;
            overflow-x: hidden;
            min-height: 100vh;
        }

        /* Animated Background */
        .bg-canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            opacity: 0.4;
            pointer-events: none;
        }

        /* Scanlines */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: repeating-linear-gradient(
                0deg,
                rgba(0, 0, 0, 0.12),
                rgba(0, 0, 0, 0.12) 1px,
                transparent 1px,
                transparent 3px
            );
            pointer-events: none;
            z-index: 9999;
            animation: scanlines 8s linear infinite;
        }

        @keyframes scanlines {
            0% { transform: translateY(0); }
            100% { transform: translateY(3px); }
        }

        /* Noise Texture */
        body::after {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
            opacity: 0.03;
            pointer-events: none;
            z-index: 9998;
        }

        /* Header Section */
        .header {
            position: relative;
            padding: 100px 60px 80px;
            background: linear-gradient(180deg, var(--bg-secondary) 0%, transparent 100%);
            border-bottom: 1px solid var(--border-subtle);
            overflow: hidden;
        }

        .header-grid {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
                linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px),
                linear-gradient(var(--border-subtle) 1px, transparent 1px);
            background-size: 80px 80px;
            opacity: 0.5;
            animation: gridMove 20s linear infinite;
        }

        @keyframes gridMove {
            0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
            100% { transform: perspective(500px) rotateX(60deg) translateY(80px); }
        }

        .header-content {
            max-width: 1400px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 60px;
        }

        .system-badge {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: var(--neon-cyan);
            letter-spacing: 3px;
            text-transform: uppercase;
            padding: 8px 16px;
            border: 1px solid var(--neon-cyan);
            background: rgba(0, 245, 212, 0.05);
            position: relative;
            overflow: hidden;
        }

        .system-badge::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(0, 245, 212, 0.2), transparent);
            animation: badgeShine 3s infinite;
        }

        @keyframes badgeShine {
            0%, 100% { left: -100%; }
            50% { left: 100%; }
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--text-muted);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--neon-cyan);
            box-shadow: 0 0 10px var(--neon-cyan);
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
        }

        .glitch-text {
            font-family: 'Syncopate', sans-serif;
            font-size: 64px;
            font-weight: 700;
            color: var(--text-primary);
            text-transform: uppercase;
            letter-spacing: -2px;
            position: relative;
            line-height: 1.1;
            margin-bottom: 20px;
        }

        .glitch-text .highlight {
            color: var(--neon-cyan);
            text-shadow: 0 0 20px rgba(0, 245, 212, 0.5);
        }

        .glitch-text::before,
        .glitch-text::after {
            content: attr(data-text);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.8;
        }

        .glitch-text::before {
            color: var(--neon-pink);
            animation: glitch-1 3s infinite linear alternate-reverse;
            clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
        }

        .glitch-text::after {
            color: var(--neon-purple);
            animation: glitch-2 2s infinite linear alternate-reverse;
            clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
        }

        @keyframes glitch-1 {
            0%, 90%, 100% { transform: translate(0); }
            92% { transform: translate(-4px, 2px); }
            94% { transform: translate(4px, -2px); }
            96% { transform: translate(-2px, 1px); }
        }

        @keyframes glitch-2 {
            0%, 85%, 100% { transform: translate(0); }
            87% { transform: translate(3px, -1px); }
            89% { transform: translate(-3px, 1px); }
            91% { transform: translate(2px, -2px); }
        }

        .header-subtitle {
            font-size: 18px;
            color: var(--text-secondary);
            max-width: 600px;
            margin-bottom: 40px;
        }

        .header-meta {
            display: flex;
            gap: 40px;
            flex-wrap: wrap;
        }

        .meta-card {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            padding: 20px 24px;
            min-width: 160px;
            position: relative;
            overflow: hidden;
            transition: all 0.3s var(--ease-out-expo);
        }

        .meta-card:hover {
            border-color: var(--border-glow);
            transform: translateY(-2px);
            box-shadow: var(--shadow-glow);
        }

        .meta-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 3px;
            height: 100%;
            background: var(--neon-cyan);
        }

        .meta-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 8px;
        }

        .meta-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 24px;
            color: var(--text-primary);
            font-weight: 500;
        }

        /* Main Container */
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 60px;
            position: relative;
            z-index: 1;
        }

        /* Stats Dashboard */
        .stats-dashboard {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 60px;
        }

        .stat-box {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            padding: 32px;
            position: relative;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.4s var(--ease-out-expo);
        }

        .stat-box::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: currentColor;
            transform: scaleX(0);
            transform-origin: left;
            transition: transform 0.4s var(--ease-out-expo);
        }

        .stat-box:hover::before {
            transform: scaleX(1);
        }

        .stat-box:hover {
            transform: translateY(-4px);
            border-color: currentColor;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 30px currentColor;
        }

        .stat-box.critical { color: var(--neon-red); }
        .stat-box.warning { color: var(--neon-yellow); }
        .stat-box.info { color: var(--neon-cyan); }
        .stat-box.total { color: var(--neon-purple); }

        .stat-box.critical { --glow-color: rgba(251, 86, 7, 0.3); }
        .stat-box.warning { --glow-color: rgba(255, 190, 11, 0.3); }
        .stat-box.info { --glow-color: rgba(0, 245, 212, 0.3); }
        .stat-box.total { --glow-color: rgba(131, 56, 236, 0.3); }

        .stat-box:hover {
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 40px var(--glow-color);
        }

        .stat-icon {
            font-size: 28px;
            margin-bottom: 16px;
            opacity: 0.8;
        }

        .stat-label-main {
            font-family: 'Syncopate', sans-serif;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 12px;
            opacity: 0.7;
        }

        .stat-value-main {
            font-family: 'JetBrains Mono', monospace;
            font-size: 56px;
            font-weight: 700;
            line-height: 1;
            text-shadow: 0 0 30px currentColor;
        }

        /* Controls Bar */
        .controls-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            padding: 20px 24px;
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
        }

        .filter-tabs {
            display: flex;
            gap: 8px;
        }

        .filter-tab {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            padding: 10px 20px;
            background: transparent;
            border: 1px solid var(--border-subtle);
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .filter-tab:hover {
            border-color: var(--neon-cyan);
            color: var(--neon-cyan);
        }

        .filter-tab.active {
            background: var(--neon-cyan);
            border-color: var(--neon-cyan);
            color: var(--bg-primary);
            font-weight: 600;
        }

        .search-box {
            position: relative;
        }

        .search-input {
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            padding: 10px 16px 10px 40px;
            background: var(--bg-primary);
            border: 1px solid var(--border-subtle);
            color: var(--text-primary);
            width: 280px;
            transition: all 0.3s ease;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--neon-cyan);
            box-shadow: 0 0 20px rgba(0, 245, 212, 0.1);
        }

        .search-input::placeholder {
            color: var(--text-muted);
        }

        .search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 14px;
        }

        /* Section Header */
        .section-header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 32px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border-subtle);
        }

        .section-title {
            font-family: 'Syncopate', sans-serif;
            font-size: 20px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: var(--text-primary);
        }

        .section-line {
            flex: 1;
            height: 1px;
            background: linear-gradient(90deg, var(--border-subtle), transparent);
        }

        .section-count {
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            color: var(--text-muted);
            padding: 6px 12px;
            border: 1px solid var(--border-subtle);
        }

        /* Flow Diagram Section */
        .flow-diagram-section {
            margin: 60px 0;
            padding: 40px;
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            position: relative;
            overflow: hidden;
        }

        .flow-diagram-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple), var(--neon-pink));
        }

        .flow-title {
            font-family: 'Syncopate', sans-serif;
            font-size: 18px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 4px;
            color: var(--neon-cyan);
            margin-bottom: 40px;
            text-align: center;
        }

        /* Flow Analysis Section */
        .flow-analysis-section {
            margin: 60px 0;
            padding: 40px;
            background: linear-gradient(135deg, rgba(131, 56, 236, 0.05), rgba(0, 245, 212, 0.03));
            border: 1px solid var(--neon-purple);
            border-radius: 12px;
            position: relative;
        }

        .flow-analysis-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--neon-pink), var(--neon-purple), var(--neon-cyan));
            border-radius: 12px 12px 0 0;
        }

        .flow-analysis-intro {
            color: var(--text-secondary);
            font-size: 14px;
            margin-bottom: 32px;
            padding: 16px 20px;
            background: rgba(0, 0, 0, 0.2);
            border-left: 3px solid var(--neon-purple);
            border-radius: 4px;
        }

        .flow-analysis-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 24px;
        }

        .flow-analysis-card {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            padding: 24px;
            transition: all 0.4s var(--ease-out-expo);
            position: relative;
            overflow: hidden;
        }

        .flow-analysis-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
        }

        .flow-analysis-card.critical::before { background: var(--neon-red); }
        .flow-analysis-card.warning::before { background: var(--neon-yellow); }
        .flow-analysis-card.info::before { background: var(--neon-cyan); }

        .flow-analysis-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(131, 56, 236, 0.2);
            border-color: var(--neon-purple);
        }

        .flow-analysis-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }

        .flow-analysis-badge {
            font-family: 'JetBrains Mono', monospace;
            font-size: 9px;
            font-weight: 700;
            padding: 4px 8px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .flow-analysis-badge.critical {
            background: rgba(251, 86, 7, 0.2);
            color: var(--neon-red);
            border: 1px solid var(--neon-red);
        }

        .flow-analysis-badge.warning {
            background: rgba(255, 190, 11, 0.2);
            color: var(--neon-yellow);
            border: 1px solid var(--neon-yellow);
        }

        .flow-analysis-badge.info {
            background: rgba(0, 245, 212, 0.2);
            color: var(--neon-cyan);
            border: 1px solid var(--neon-cyan);
        }

        .flow-analysis-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .flow-analysis-location {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: var(--neon-purple);
            margin-bottom: 12px;
            padding: 6px 10px;
            background: rgba(131, 56, 236, 0.1);
            border-radius: 4px;
            display: inline-block;
        }

        .flow-analysis-desc {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.7;
            margin-bottom: 20px;
        }

        .flow-analysis-diagram {
            background: var(--bg-primary);
            border: 1px solid var(--border-subtle);
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 16px;
            overflow-x: auto;
        }

        .flow-analysis-diagram .mermaid {
            display: flex;
            justify-content: center;
        }

        .flow-analysis-fix {
            font-size: 12px;
            color: var(--neon-yellow);
            padding: 12px 16px;
            background: rgba(255, 190, 11, 0.05);
            border: 1px solid rgba(255, 190, 11, 0.2);
            border-radius: 4px;
        }

        .flow-steps {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            position: relative;
            padding: 0 40px;
        }

        .flow-steps::before {
            content: '';
            position: absolute;
            top: 30px;
            left: 40px;
            right: 40px;
            height: 2px;
            background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple), var(--neon-pink), var(--neon-cyan));
        }

        .flow-step {
            flex: 1;
            text-align: center;
            position: relative;
            z-index: 1;
        }

        .step-number {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: var(--bg-primary);
            border: 2px solid var(--neon-cyan);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'JetBrains Mono', monospace;
            font-size: 20px;
            font-weight: 700;
            color: var(--neon-cyan);
            margin: 0 auto 16px;
            box-shadow: 0 0 20px rgba(0, 245, 212, 0.3);
            position: relative;
        }

        .step-number::after {
            content: '';
            position: absolute;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--neon-cyan);
            animation: stepPulse 2s infinite;
        }

        @keyframes stepPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.5; }
        }

        .step-content {
            background: var(--bg-secondary);
            padding: 20px;
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            position: relative;
        }

        .step-content::before {
            content: '';
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 8px solid var(--bg-secondary);
        }

        .step-title {
            font-family: 'Syncopate', sans-serif;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--neon-cyan);
            margin-bottom: 8px;
        }

        .step-description {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.6;
        }

        .step-icon {
            font-size: 24px;
            margin-bottom: 12px;
            opacity: 0.8;
        }

        /* Issues List */
        .issues-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .issue-card {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            position: relative;
            overflow: hidden;
            transition: all 0.4s var(--ease-out-expo);
            animation: fadeInUp 0.6s ease forwards;
            opacity: 0;
        }

        .issue-card.hidden {
            display: none;
        }

        .issue-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            transition: all 0.3s ease;
        }

        .issue-card.critical::before { background: var(--neon-red); }
        .issue-card.warning::before { background: var(--neon-yellow); }
        .issue-card.info::before { background: var(--neon-cyan); }

        .issue-card:hover {
            transform: translateX(8px);
            border-color: var(--border-glow);
            box-shadow: var(--shadow-glow);
        }

        .issue-card.critical { --issue-color: var(--neon-red); }
        .issue-card.warning { --issue-color: var(--neon-yellow); }
        .issue-card.info { --issue-color: var(--neon-cyan); }

        .issue-card:hover::before {
            width: 6px;
            box-shadow: 0 0 20px var(--issue-color);
        }

        .issue-header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-subtle);
            cursor: pointer;
        }

        .issue-header-left {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .issue-toggle {
            font-size: 12px;
            color: var(--text-muted);
            transition: transform 0.3s ease;
        }

        .issue-card.expanded .issue-toggle {
            transform: rotate(90deg);
        }

        .issue-type-badge {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 4px 10px;
            background: rgba(0, 245, 212, 0.1);
            border: 1px solid var(--neon-cyan);
            color: var(--neon-cyan);
        }

        .issue-title-compact {
            font-size: 15px;
            font-weight: 500;
            color: var(--text-primary);
        }

        .issue-severity-badge {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            padding: 6px 14px;
            border: 1px solid currentColor;
        }

        .issue-severity-badge.critical { 
            color: var(--neon-red); 
            background: rgba(251, 86, 7, 0.1);
            border-color: var(--neon-red);
        }
        .issue-severity-badge.warning { 
            color: var(--neon-yellow); 
            background: rgba(255, 190, 11, 0.1);
            border-color: var(--neon-yellow);
        }
        .issue-severity-badge.info { 
            color: var(--neon-cyan); 
            background: rgba(0, 245, 212, 0.1);
            border-color: var(--neon-cyan);
        }

        .issue-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s var(--ease-out-expo);
        }

        .issue-card.expanded .issue-content {
            max-height: 2000px;
        }

        .issue-body {
            padding: 24px;
        }

        .issue-location {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--neon-purple);
            margin-bottom: 16px;
            padding: 10px 14px;
            background: rgba(131, 56, 236, 0.08);
            border-left: 3px solid var(--neon-purple);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .issue-location::before {
            content: '//';
            color: var(--text-muted);
        }

        .issue-description {
            color: var(--text-secondary);
            font-size: 15px;
            line-height: 1.8;
            margin-bottom: 20px;
        }

        .issue-fix {
            font-size: 14px;
            color: var(--neon-yellow);
            padding: 16px 20px;
            background: rgba(255, 190, 11, 0.05);
            border: 1px solid rgba(255, 190, 11, 0.2);
            margin-bottom: 20px;
        }

        .flowchart-container {
            margin: 24px 0;
            padding: 24px;
            background: linear-gradient(135deg, rgba(0, 245, 212, 0.02), rgba(131, 56, 236, 0.02));
            border: 1px solid var(--neon-purple);
            border-radius: 8px;
            position: relative;
            box-shadow: 0 0 20px rgba(131, 56, 236, 0.1);
        }

        .flowchart-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple), var(--neon-pink));
            border-radius: 8px 8px 0 0;
        }

        .flowchart-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-subtle);
        }

        .flowchart-icon {
            color: var(--neon-purple);
            font-size: 16px;
            animation: pulse 2s ease-in-out infinite;
        }

        .flowchart-container .mermaid {
            padding: 20px;
            background: rgba(10, 10, 15, 0.6);
            border-radius: 4px;
            overflow-x: auto;
        }

        .flowchart-container .mermaid svg {
            max-width: 100%;
            height: auto;
        }

        .issue-fix-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--neon-yellow);
            margin-bottom: 8px;
            opacity: 0.8;
        }

        .code-block {
            background: var(--bg-code);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            overflow: hidden;
        }

        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-subtle);
        }

        .code-lang {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--text-muted);
        }

        .code-actions {
            display: flex;
            gap: 8px;
        }

        .code-action {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            color: var(--text-muted);
            background: transparent;
            border: 1px solid var(--border-subtle);
            padding: 4px 10px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .code-action:hover {
            border-color: var(--neon-cyan);
            color: var(--neon-cyan);
        }

        .code-content {
            padding: 20px;
            overflow-x: auto;
        }

        .code-content pre {
            margin: 0;
        }

        .code-content code {
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            line-height: 1.7;
            color: var(--text-primary);
        }

        /* Syntax Highlighting */
        .code-keyword { color: var(--neon-pink); }
        .code-string { color: var(--neon-yellow); }
        .code-comment { color: var(--text-muted); font-style: italic; }
        .code-function { color: var(--neon-blue); }
        .code-number { color: var(--neon-purple); }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 100px 40px;
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            position: relative;
            overflow: hidden;
        }

        .empty-state::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple), var(--neon-pink));
        }

        .empty-icon {
            font-size: 64px;
            margin-bottom: 24px;
            opacity: 0.5;
        }

        .empty-state h3 {
            font-family: 'Syncopate', sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: var(--neon-cyan);
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 4px;
        }

        .empty-state p {
            color: var(--text-secondary);
            font-size: 15px;
        }

        /* Category Distribution */
        .category-section {
            margin-top: 60px;
        }

        .category-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
        }

        .category-card {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            padding: 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .category-card:hover {
            border-color: var(--border-glow);
            transform: translateY(-2px);
        }

        .category-icon {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-secondary);
            border: 1px solid var(--border-subtle);
            font-size: 20px;
        }

        .category-info {
            flex: 1;
        }

        .category-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 4px;
        }

        .category-count {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--text-muted);
        }

        .category-bar {
            width: 60px;
            height: 4px;
            background: var(--bg-secondary);
            position: relative;
            overflow: hidden;
        }

        .category-bar-fill {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            background: var(--neon-cyan);
            transition: width 0.6s var(--ease-out-expo);
        }

        /* Footer */
        .footer {
            background: var(--bg-secondary);
            padding: 60px;
            text-align: center;
            border-top: 1px solid var(--border-subtle);
            position: relative;
            margin-top: 100px;
        }

        .footer-content {
            max-width: 1400px;
            margin: 0 auto;
        }

        .footer-logo {
            font-family: 'Syncopate', sans-serif;
            font-size: 14px;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 4px;
            margin-bottom: 16px;
        }

        .footer-text {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: var(--text-muted);
            letter-spacing: 2px;
        }

        .footer-line {
            width: 100px;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
            margin: 30px auto;
        }

        /* Animations */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        ${issues ? issues.map((_, idx) => `.issue-card:nth-child(${idx + 1}) { animation-delay: ${(idx + 1) * 0.08}s; }`).join('\n        ') : ''}

        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: var(--bg-primary);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--bg-hover);
            border-color: var(--neon-cyan);
        }

        /* Responsive */
        @media (max-width: 1200px) {
            .stats-dashboard {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        @media (max-width: 768px) {
            .header {
                padding: 60px 24px;
            }

            .glitch-text {
                font-size: 36px;
            }

            .container {
                padding: 40px 24px;
            }

            .stats-dashboard {
                grid-template-columns: 1fr;
            }

            .header-meta {
                flex-direction: column;
            }

            .controls-bar {
                flex-direction: column;
                gap: 16px;
            }

            .search-input {
                width: 100%;
            }

            .issue-header-bar {
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
            }

            .flow-steps {
                flex-direction: column;
                gap: 40px;
            }

            .flow-steps::before {
                display: none;
            }
        }
    </style>
</head>
<body>
    <canvas class="bg-canvas" id="bgCanvas"></canvas>
    
    <div class="header">
        <div class="header-grid"></div>
        <div class="header-content">
            <div class="header-top">
                <div class="system-badge">SYSTEM_ANALYSIS_V2.0</div>
                <div class="status-indicator">
                    <span class="status-dot"></span>
                    <span>ONLINE</span>
                </div>
            </div>
            
            <h1 class="glitch-text" data-text="CODE REVIEW REPORT">
                <span class="highlight">CODE</span> REVIEW REPORT
            </h1>
            
            <p class="header-subtitle">
                Comprehensive security and quality analysis of your codebase. 
                Identifying vulnerabilities, anti-patterns, and optimization opportunities.
            </p>
            
            <div class="header-meta">
                <div class="meta-card">
                    <div class="meta-label">Timestamp</div>
                    <div class="meta-value">${formatDate(metadata.reviewedAt)}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">Files Analyzed</div>
                    <div class="meta-value">${metadata.filesReviewed || 0}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">Total Lines</div>
                    <div class="meta-value">${metadata.totalLines || 0}</div>
                </div>
                <div class="meta-card">
                    <div class="meta-label">Duration</div>
                    <div class="meta-value">${metadata.duration || '< 1s'}</div>
                </div>
            </div>
        </div>
    </div>

    <div class="container">
        <!-- Stats Dashboard -->
        <div class="stats-dashboard">
            <div class="stat-box critical" data-filter="critical">
                <div class="stat-icon">⚠</div>
                <div class="stat-label-main">Critical</div>
                <div class="stat-value-main">${severityStats.critical}</div>
            </div>
            <div class="stat-box warning" data-filter="warning">
                <div class="stat-icon">◈</div>
                <div class="stat-label-main">Warning</div>
                <div class="stat-value-main">${severityStats.warning}</div>
            </div>
            <div class="stat-box info" data-filter="info">
                <div class="stat-icon">◉</div>
                <div class="stat-label-main">Info</div>
                <div class="stat-value-main">${severityStats.info}</div>
            </div>
            <div class="stat-box total" data-filter="all">
                <div class="stat-icon">◆</div>
                <div class="stat-label-main">Total</div>
                <div class="stat-value-main">${issues ? issues.length : 0}</div>
            </div>
        </div>

        ${hasFlowcharts ? `
        <!-- Process Flow Analysis Section -->
        <div class="flow-analysis-section">
            <div class="section-header">
                <h2 class="section-title">⚡ Process Flow Analysis</h2>
                <div class="section-line"></div>
                <span class="section-count">${flowchartIssues.length} FLOWS DETECTED</span>
            </div>
            <p class="flow-analysis-intro">
                The following issues contain process flow diagrams that visualize problematic code paths or architectural concerns.
            </p>
            <div class="flow-analysis-grid">
                ${flowchartIssues.map((issue, idx) => `
                <div class="flow-analysis-card ${issue.severity || 'info'}">
                    <div class="flow-analysis-header">
                        <span class="flow-analysis-badge ${issue.severity || 'info'}">${(issue.severity || 'INFO').toUpperCase()}</span>
                        <span class="flow-analysis-title">${escapeHtml(issue.title || 'Process Issue')}</span>
                    </div>
                    <div class="flow-analysis-location">${escapeHtml(issue.location || 'Unknown Location')}</div>
                    <div class="flow-analysis-desc">${formatMultiline(escapeHtml(issue.description || ''))}</div>
                    <div class="flow-analysis-diagram">
                        <div class="mermaid" id="flow-summary-${idx}">
${issue.flowchart}
                        </div>
                    </div>
                    ${issue.fix ? `<div class="flow-analysis-fix">💡 ${formatMultiline(escapeHtml(issue.fix))}</div>` : ''}
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        ${issues && issues.length > 0 ? `
        <!-- Controls Bar -->
        <div class="controls-bar">
            <div class="filter-tabs">
                <button class="filter-tab active" data-filter="all">All Issues</button>
                <button class="filter-tab" data-filter="critical">Critical</button>
                <button class="filter-tab" data-filter="warning">Warning</button>
                <button class="filter-tab" data-filter="info">Info</button>
            </div>
            <div class="search-box">
                <span class="search-icon">⌕</span>
                <input type="text" class="search-input" placeholder="Search issues..." id="searchInput">
            </div>
        </div>

        <!-- Issues Section -->
        <div class="section-header">
            <h2 class="section-title">Detected Issues</h2>
            <div class="section-line"></div>
            <span class="section-count" id="issueCount">${issues.length} FOUND</span>
        </div>

        <div class="issues-list" id="issuesList">
            ${issues.map((issue, idx) => `
            <div class="issue-card ${issue.severity || 'info'}" data-severity="${issue.severity || 'info'}" data-index="${idx}">
                <div class="issue-header-bar" onclick="toggleIssue(${idx})">
                    <div class="issue-header-left">
                        <span class="issue-toggle">▶</span>
                        <span class="issue-type-badge">${issue.type || 'ISSUE'}</span>
                        <span class="issue-title-compact">${escapeHtml(issue.title || 'Untitled Issue')}</span>
                    </div>
                    <span class="issue-severity-badge ${issue.severity || 'info'}">${(issue.severity || 'INFO').toUpperCase()}</span>
                </div>
                <div class="issue-content">
                    <div class="issue-body">
                        ${issue.location ? `<div class="issue-location">${escapeHtml(issue.location)}</div>` : ''}
                        <p class="issue-description">${formatMultiline(escapeHtml(issue.description || ''))}</p>
                        ${issue.flowchart && issue.flowchart.trim() && issue.flowchart.trim() !== 'flowchart' ? `
                        <div class="flowchart-container">
                            <div class="flowchart-header">
                                <span class="flowchart-icon">◇</span>
                                <span class="issue-fix-label">Process Flow Analysis</span>
                            </div>
                            <div class="mermaid" id="flowchart-${idx}">
${issue.flowchart}
                            </div>
                        </div>
                        ` : ''}
                        ${issue.fix ? `
                        <div class="issue-fix">
                            <div class="issue-fix-label">Suggested Fix</div>
                            ${formatMultiline(escapeHtml(issue.fix))}
                        </div>
                        ` : ''}
                        ${issue.code ? `
                        <div class="code-block">
                            <div class="code-header">
                                <span class="code-lang">Source Code</span>
                                <div class="code-actions">
                                    <button class="code-action" onclick="copyCode(this)">Copy</button>
                                </div>
                            </div>
                            <div class="code-content">
                                <pre><code>${syntaxHighlight(escapeHtml(issue.code))}</code></pre>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            `).join('')}
        </div>

        <!-- Category Distribution -->
        <div class="category-section">
            <div class="section-header">
                <h2 class="section-title">Issue Categories</h2>
                <div class="section-line"></div>
            </div>
            <div class="category-grid">
                ${Object.entries(issuesByType).map(([type, count]) => `
                <div class="category-card">
                    <div class="category-icon">◆</div>
                    <div class="category-info">
                        <div class="category-name">${type}</div>
                        <div class="category-count">${count} issues</div>
                    </div>
                    <div class="category-bar">
                        <div class="category-bar-fill" style="width: ${(count / issues.length * 100).toFixed(1)}%"></div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : `
        <div class="empty-state">
            <div class="empty-icon">✓</div>
            <h3>All Systems Clear</h3>
            <p>No vulnerabilities or issues detected. Your code has passed security review.</p>
        </div>
        `}
    </div>

    <div class="footer">
        <div class="footer-content">
            <div class="footer-logo">CODE REVIEW SYSTEM</div>
            <div class="footer-line"></div>
            <p class="footer-text">// ANALYSIS COMPLETE // REPORT GENERATED ${new Date().toISOString()} //</p>
        </div>
    </div>

    <script>
        const issues = ${issuesJson};
        
        // Animated Background
        const canvas = document.getElementById('bgCanvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        class Particle {
            constructor() {
                this.reset();
            }
            
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.5 + 0.1;
            }
            
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                
                if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
                if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            }
            
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = \`rgba(0, 245, 212, \${this.opacity})\`;
                ctx.fill();
            }
        }
        
        for (let i = 0; i < 50; i++) {
            particles.push(new Particle());
        }
        
        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(article => {
                article.update();
                article.draw();
            });
            
            // Draw connections
            particles.forEach((p1, i) => {
                particles.slice(i + 1).forEach(p2 => {
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = \`rgba(0, 245, 212, \${0.1 * (1 - dist / 150)})\`;
                        ctx.stroke();
                    }
                });
            });
            
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
        
        // Issue Toggle
        function toggleIssue(index) {
            const card = document.querySelector(\`.issue-card[data-index="\${index}"]\`);
            card.classList.toggle('expanded');
        }
        
        // Filter Functionality
        const filterTabs = document.querySelectorAll('.filter-tab');
        const statBoxes = document.querySelectorAll('.stat-box');
        const issueCards = document.querySelectorAll('.issue-card');
        const issueCount = document.getElementById('issueCount');
        
        function filterIssues(filter) {
            let visibleCount = 0;
            
            issueCards.forEach(card => {
                if (filter === 'all' || card.dataset.severity === filter) {
                    card.classList.remove('hidden');
                    visibleCount++;
                } else {
                    card.classList.add('hidden');
                }
            });
            
            issueCount.textContent = \`\${visibleCount} FOUND\`;
            
            // Update active tab
            filterTabs.forEach(tab => {
                tab.classList.toggle('active', tab.dataset.filter === filter);
            });
        }
        
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => filterIssues(tab.dataset.filter));
        });
        
        statBoxes.forEach(box => {
            box.addEventListener('click', () => filterIssues(box.dataset.filter));
        });
        
        // Search Functionality
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            let visibleCount = 0;
            
            issueCards.forEach(card => {
                const title = card.querySelector('.issue-title-compact').textContent.toLowerCase();
                const type = card.querySelector('.issue-type-badge').textContent.toLowerCase();
                
                if (title.includes(query) || type.includes(query)) {
                    card.classList.remove('hidden');
                    visibleCount++;
                } else {
                    card.classList.add('hidden');
                }
            });
            
            issueCount.textContent = \`\${visibleCount} FOUND\`;
        });
        
        // Copy Code
        function copyCode(btn) {
            const code = btn.closest('.code-block').querySelector('code').textContent;
            navigator.clipboard.writeText(code).then(() => {
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            });
        }
        
        // Animate category bars on scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.width = entry.target.style.width;
                }
            });
        });
        
        document.querySelectorAll('.category-bar-fill').forEach(bar => {
            observer.observe(bar);
        });

        mermaid.initialize({ 
            startOnLoad: true, 
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'Space Grotesk'
        });
    </script>
</body>
</html>`;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function syntaxHighlight(code) {
    // 先处理换行符，将 \n 转换为占位符，避免被其他正则影响
    const lineBreakPlaceholder = '__LINEBREAK__';
    let result = code.replace(/\\n/g, lineBreakPlaceholder);
    
    // 使用占位符方式避免嵌套替换问题
    const placeholders = [];
    let placeholderIndex = 0;

    // 创建占位符替换函数
    function createPlaceholder(content) {
        const placeholder = `__PLACEHOLDER_${placeholderIndex}__`;
        placeholders.push({ placeholder, content });
        placeholderIndex++;
        return placeholder;
    }

    // 恢复占位符
    function restorePlaceholders(text) {
        let result = text;
        // 反向恢复，避免新插入的内容影响后续替换
        for (let i = placeholders.length - 1; i >= 0; i--) {
            result = result.replace(placeholders[i].placeholder, placeholders[i].content);
        }
        return result;
    }

    // 1. 先处理注释（不能被其他规则影响）
    result = result.replace(/(\/\/.*$)/gm, (match) => {
        return createPlaceholder(`<span class="code-comment">${match}</span>`);
    });

    // 2. 处理字符串 - 使用 HTML 转义后的引号
    result = result.replace(/(&quot;.*?&quot;)/g, (match) => {
        return createPlaceholder(`<span class="code-string">${match}</span>`);
    });

    // 3. 处理单引号字符串
    result = result.replace(/(&#039;.*?&#039;)/g, (match) => {
        return createPlaceholder(`<span class="code-string">${match}</span>`);
    });

    // 4. 处理关键字
    const keywords = [
        'public', 'private', 'protected', 'static', 'final', 'void', 'class',
        'interface', 'import', 'package', 'if', 'else', 'for', 'while', 'return',
        'new', 'try', 'catch', 'throw', 'throws', 'extends', 'implements',
        'synchronized', 'volatile', 'transient', 'abstract', 'native', 'this',
        'super', 'null', 'true', 'false', 'instanceof', 'switch', 'case',
        'default', 'break', 'continue', 'finally', 'do', 'enum', 'assert',
        'const', 'let', 'var', 'function', 'async', 'await', 'yield',
        'typeof', 'in', 'of', 'delete', 'with', 'debugger'
    ];

    const keywordPattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    result = result.replace(keywordPattern, (match) => {
        return createPlaceholder(`<span class="code-keyword">${match}</span>`);
    });

    // 5. 处理类型关键字（Java 常用类）
    const types = [
        // 基础类型
        'String', 'int', 'boolean', 'long', 'double', 'float', 'char', 'byte', 'short',
        // 包装类型
        'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Byte', 'Short', 'Character', 'Void',
        // 集合类型
        'Object', 'List', 'Map', 'Set', 'Collection', 'Iterable', 'Iterator',
        'ArrayList', 'HashMap', 'HashSet', 'LinkedList', 'TreeMap', 'TreeSet',
        'LinkedHashMap', 'LinkedHashSet', 'ConcurrentHashMap', 'CopyOnWriteArrayList',
        // 工具类
        'Optional', 'Stream', 'Arrays', 'Collections', 'Objects', 'Comparator',
        // 时间类
        'Date', 'LocalDate', 'LocalTime', 'LocalDateTime', 'Instant', 'Duration',
        'BigDecimal', 'BigInteger',
        // 异常类
        'Exception', 'RuntimeException', 'IllegalArgumentException', 'NullPointerException',
        'IllegalStateException', 'IndexOutOfBoundsException', 'ConcurrentModificationException',
        // IO 类
        'File', 'InputStream', 'OutputStream', 'Reader', 'Writer', 'BufferedReader',
        // 线程类
        'Thread', 'Runnable', 'Callable', 'Future', 'CompletableFuture', 'ExecutorService',
        // Spring 常用类
        'Autowired', 'Service', 'Component', 'Repository', 'Controller', 'RestController',
        'RequestMapping', 'GetMapping', 'PostMapping', 'PutMapping', 'DeleteMapping',
        'RequestParam', 'PathVariable', 'RequestBody', 'ResponseBody'
    ];

    const typePattern = new RegExp(`\\b(${types.join('|')})\\b`, 'g');
    result = result.replace(typePattern, (match) => {
        return createPlaceholder(`<span class="code-keyword">${match}</span>`);
    });

    // 6. 处理注解
    result = result.replace(/(@\w+)/g, (match) => {
        return createPlaceholder(`<span class="code-function">${match}</span>`);
    });

    // 7. 处理函数调用（后跟括号的标识符）- 排除占位符
    result = result.replace(/(\b(?!__PLACEHOLDER_)\w+\b)(?=\()/g, (match) => {
        return createPlaceholder(`<span class="code-function">${match}</span>`);
    });

    // 8. 处理数字 - 排除占位符中的数字
    result = result.replace(/(?<!PLACEHOLDER_)\b(\d+(?:\.\d+)?)\b(?!__)/g, (match) => {
        return createPlaceholder(`<span class="code-number">${match}</span>`);
    });

    // 恢复所有占位符
    result = restorePlaceholders(result);
    
    // 最后将换行符占位符转换为 <br> 标签
    result = result.replace(new RegExp(lineBreakPlaceholder, 'g'), '<br>');
    
    return result;
}

/**
 * 处理文本中的换行符，将 \n 转换为 <br>
 */
function formatMultiline(text) {
    if (!text) return '';
    return text.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
}

function formatDate(dateStr) {
    if (!dateStr) return new Date().toLocaleString();
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function groupIssuesByType(issues) {
    const groups = {};
    issues.forEach(issue => {
        const type = issue.type || 'OTHER';
        groups[type] = (groups[type] || 0) + 1;
    });
    return groups;
}
