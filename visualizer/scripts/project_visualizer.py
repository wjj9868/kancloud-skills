#!/usr/bin/env python3
"""
入职报告生成器 V7 - 无硬编码推断
所有模块描述由 AI 填入文档后读取
"""

import json
import argparse
import webbrowser
from pathlib import Path
from datetime import datetime


def generate_report(modules_json: str, docs_dir: str, output: str, auto_open: bool = True):
    with open(modules_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    docs_path = Path(docs_dir)
    
    module_docs = {}
    module_summaries = {}
    
    for module in data['modules']:
        md_file = docs_path / f"{module['name']}.md"
        if md_file.exists():
            content = md_file.read_text(encoding='utf-8')
            # 从文档中提取概述（第一个 ## 模块概述 后的内容）
            summary = extract_summary(content)
            module_summaries[module['name']] = summary
            content = content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            module_docs[module['name']] = content
    
    quickstart = ""
    if (docs_path / 'QUICKSTART.md').exists():
        quickstart = (docs_path / 'QUICKSTART.md').read_text(encoding='utf-8')
        quickstart = quickstart.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    nav_items = '''
        <div class="nav-item active" data-module="QUICKSTART" onclick="showModule('QUICKSTART')">
            <div class="nav-dot"></div>
            <div class="nav-info">
                <span class="nav-name">快速启动</span>
                <span class="nav-desc">环境配置与服务启动</span>
            </div>
        </div>
        <div class="nav-sep"></div>
    '''
    
    for module in data['modules']:
        # 使用从文档提取的概述，如果没有则显示待分析
        summary = module_summaries.get(module['name'], '待分析')
        if not summary or 'AI_FILL' in summary:
            summary = '待分析'
        
        nav_items += f'''
        <div class="nav-item" data-module="{module['name']}" onclick="showModule('{module['name']}')">
            <div class="nav-dot {module['type']}"></div>
            <div class="nav-info">
                <span class="nav-name">{module['name']}</span>
                <span class="nav-desc">{summary[:30]}{'...' if len(summary) > 30 else ''}</span>
            </div>
        </div>'''
    
    docs_js = "const docs = {\n"
    docs_js += f'  "QUICKSTART": `{escape_js(quickstart)}`,\n'
    for name, content in module_docs.items():
        docs_js += f'  "{name}": `{escape_js(content)}`,\n'
    docs_js += "};"
    
    html = generate_html(data, nav_items, docs_js)
    Path(output).write_text(html, encoding='utf-8')
    print(f"[OK] {output}")
    
    if auto_open:
        webbrowser.open(f"file://{Path(output).resolve()}")


def extract_summary(content: str) -> str:
    """从 Markdown 中提取模块概述"""
    lines = content.split('\n')
    in_overview = False
    summary_lines = []
    
    for line in lines:
        if '## 模块概述' in line or '## Module Overview' in line:
            in_overview = True
            continue
        if in_overview:
            if line.startswith('## '):
                break
            if line.strip() and not line.startswith('<!--'):
                summary_lines.append(line.strip())
                if len(summary_lines) >= 2:
                    break
    
    return ' '.join(summary_lines)


def escape_js(s):
    return s.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')


def generate_html(data, nav_items, docs_js):
    date = datetime.now().strftime('%Y.%m.%d')
    
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{data['project_name']} | 开发者手册</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700;900&family=Noto+Sans+SC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        :root {{
            --bg: #E8E4DE;
            --paper: #FAF8F5;
            --paper-edge: #E0DCD5;
            --ink: #1C1C1C;
            --ink-mid: #3D3D3D;
            --ink-light: #6B6B6B;
            --ink-faint: #9A9A9A;
            --accent: #922B21;
            --accent-dark: #6B1F17;
            --rule: #C9C4BB;
            --sidebar-bg: #14140F;
            --sidebar-text: #F0EEE9;
            --sidebar-dim: #7A7A70;
            --java: #D35400;
            --frontend: #27AE60;
            --docs: #7F8C8D;
        }}
        
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        html, body {{ height: 100%; overflow: hidden; background: var(--bg); }}
        body {{ font-family: 'Noto Sans SC', sans-serif; color: var(--ink); }}
        
        .layout {{
            display: grid;
            grid-template-columns: 340px 1fr;
            height: 100vh;
        }}
        
        .sidebar {{
            background: var(--sidebar-bg);
            color: var(--sidebar-text);
            display: flex;
            flex-direction: column;
            border-right: 1px solid #000;
            overflow: hidden;
        }}
        
        .sb-header {{
            padding: 36px 28px 28px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }}
        
        .sb-tag {{
            display: inline-block;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--accent);
            background: rgba(146,43,33,0.15);
            padding: 4px 10px;
            margin-bottom: 16px;
        }}
        
        .sb-title {{
            font-family: 'Noto Serif SC', serif;
            font-size: 26px;
            font-weight: 700;
            line-height: 1.25;
            margin-bottom: 20px;
        }}
        
        .sb-stats {{
            font-size: 12px;
            color: var(--sidebar-dim);
        }}
        
        .sb-stats span {{ margin-right: 16px; }}
        
        .nav-label {{
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--sidebar-dim);
            padding: 20px 28px 12px;
        }}
        
        .nav-list {{
            flex: 1;
            overflow-y: auto;
            padding: 0 16px 24px;
        }}
        
        .nav-sep {{
            height: 1px;
            background: rgba(255,255,255,0.06);
            margin: 6px 12px;
        }}
        
        .nav-item {{
            display: flex;
            align-items: flex-start;
            gap: 14px;
            padding: 14px 12px;
            cursor: pointer;
            border-radius: 4px;
            border: 1px solid transparent;
            transition: all 0.12s;
        }}
        
        .nav-item:hover {{ background: rgba(255,255,255,0.04); }}
        .nav-item.active {{ background: rgba(146,43,33,0.12); border-color: var(--accent); }}
        
        .nav-dot {{
            width: 10px;
            height: 10px;
            border-radius: 2px;
            background: var(--sidebar-dim);
            margin-top: 4px;
        }}
        
        .nav-dot.java {{ background: var(--java); }}
        .nav-dot.frontend {{ background: var(--frontend); }}
        .nav-dot.docs {{ background: var(--docs); }}
        
        .nav-info {{ flex: 1; min-width: 0; }}
        .nav-name {{ display: block; font-size: 14px; font-weight: 500; margin-bottom: 3px; }}
        .nav-desc {{ display: block; font-size: 11px; color: var(--sidebar-dim); }}
        
        .main {{
            background: var(--paper);
            height: 100vh;
            overflow-y: auto;
            box-shadow: inset 2px 0 8px rgba(0,0,0,0.06);
        }}
        
        .main::before {{
            content: '';
            position: fixed;
            top: 0;
            left: 340px;
            right: 0;
            bottom: 0;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
            opacity: 0.025;
            pointer-events: none;
        }}
        
        .header {{
            padding: 32px 56px;
            border-bottom: 3px double var(--ink);
            background: var(--paper);
        }}
        
        .header-top {{
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--ink-light);
            padding-bottom: 12px;
            border-bottom: 1px solid var(--rule);
            margin-bottom: 20px;
        }}
        
        .header-title {{
            font-family: 'Noto Serif SC', serif;
            font-size: 38px;
            font-weight: 900;
            letter-spacing: 6px;
            text-align: center;
        }}
        
        .header-sub {{
            text-align: center;
            font-size: 13px;
            color: var(--ink-mid);
            margin-top: 12px;
            letter-spacing: 8px;
        }}
        
        .content {{ padding: 48px 56px 100px; }}
        
        .md {{
            font-family: 'Noto Serif SC', Georgia, serif;
            font-size: 16px;
            line-height: 1.85;
            color: var(--ink-mid);
        }}
        
        .md h1 {{
            font-size: 28px;
            font-weight: 700;
            color: var(--ink);
            border-bottom: 2px solid var(--ink);
            padding-bottom: 16px;
            margin-bottom: 28px;
        }}
        
        .md h2 {{
            font-family: 'Noto Sans SC', sans-serif;
            font-size: 16px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: var(--ink);
            margin: 48px 0 20px;
            padding: 12px 0;
            border-top: 2px solid var(--ink);
            border-bottom: 1px solid var(--rule);
        }}
        
        .md h3 {{
            font-family: 'Noto Sans SC', sans-serif;
            font-size: 14px;
            font-weight: 600;
            color: var(--ink);
            margin: 32px 0 12px;
            padding-left: 12px;
            border-left: 3px solid var(--accent);
        }}
        
        .md p {{ margin-bottom: 16px; text-align: justify; }}
        
        .md blockquote {{
            border-left: 3px solid var(--accent);
            padding: 16px 20px;
            margin: 24px 0;
            background: linear-gradient(to right, rgba(146,43,33,0.04), transparent);
            color: var(--ink-light);
            font-style: italic;
        }}
        
        .md ul, .md ol {{ margin: 16px 0; padding-left: 28px; }}
        .md li {{ margin-bottom: 8px; }}
        
        .md code {{
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            background: rgba(0,0,0,0.05);
            padding: 2px 8px;
            border-radius: 2px;
            color: var(--accent-dark);
            border: 1px solid rgba(0,0,0,0.08);
        }}
        
        .md pre {{
            background: var(--sidebar-bg);
            color: #E8E6E0;
            padding: 24px;
            margin: 24px 0;
            overflow-x: auto;
            border: 1px solid #000;
            position: relative;
        }}
        
        .md pre::before {{
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: var(--accent);
        }}
        
        .md pre code {{
            background: none;
            color: inherit;
            padding: 0;
            border: none;
        }}
        
        .md table {{
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
            font-family: 'Noto Sans SC', sans-serif;
            font-size: 13px;
        }}
        
        .md th {{
            text-align: left;
            padding: 14px 12px;
            background: var(--bg);
            border: 1px solid var(--rule);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        
        .md td {{
            padding: 12px;
            border: 1px solid var(--rule);
        }}
        
        .md a {{ color: var(--accent); text-decoration: none; }}
        .md a:hover {{ text-decoration: underline; }}
        .md hr {{ border: none; height: 1px; background: var(--rule); margin: 48px 0; }}
        .md strong {{ color: var(--ink); font-weight: 600; }}
        
        .footer {{
            text-align: center;
            padding: 24px;
            font-size: 11px;
            color: var(--ink-faint);
            border-top: 1px solid var(--rule);
            background: var(--bg);
        }}
        
        @media (max-width: 900px) {{
            .layout {{ grid-template-columns: 1fr; }}
            .sidebar {{ display: none; }}
            .main::before {{ left: 0; }}
            .header, .content {{ padding: 24px; }}
        }}
    </style>
</head>
<body>
    <div class="layout">
        <aside class="sidebar">
            <div class="sb-header">
                <div class="sb-tag">Developer Handbook</div>
                <div class="sb-title">{data['project_name']}</div>
                <div class="sb-stats">
                    <span>{data['stats']['total_modules']} 模块</span>
                    <span>{data['stats']['total_files']} 文件</span>
                    <span>{data['stats']['size_human']}</span>
                </div>
            </div>
            <div class="nav-label">目录</div>
            <div class="nav-list">{nav_items}</div>
        </aside>
        
        <main class="main">
            <header class="header">
                <div class="header-top">
                    <span>TECHNICAL DOCUMENTATION</span>
                    <span>{date}</span>
                    <span>INTERNAL USE ONLY</span>
                </div>
                <div class="header-title">{data['project_name']}</div>
                <div class="header-sub">开发者入职手册</div>
            </header>
            <div class="content">
                <div id="doc" class="md"></div>
            </div>
            <footer class="footer">Generated by Claude Project Visualizer</footer>
        </main>
    </div>
    
    <script>
        {docs_js}
        function showModule(n) {{
            document.querySelectorAll('.nav-item').forEach(e => e.classList.toggle('active', e.dataset.module === n));
            document.getElementById('doc').innerHTML = marked.parse(docs[n] || '');
            document.querySelector('.main').scrollTop = 0;
        }}
        showModule('QUICKSTART');
    </script>
</body>
</html>'''


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('-m', '--modules', required=True)
    parser.add_argument('-d', '--docs', required=True)
    parser.add_argument('-o', '--output', default='ONBOARDING_REPORT.html')
    parser.add_argument('--no-open', action='store_true')
    args = parser.parse_args()
    generate_report(args.modules, args.docs, args.output, not args.no_open)
