#!/usr/bin/env python3
"""
Module Scanner V3 - 只扫描结构，不推断职责
职责由 AI 分析代码后填写
"""

import json
import os
import argparse
from pathlib import Path
from collections import Counter

CONTAINER_KEYWORDS = ['moudel', 'module', 'modules', 'business', 'biz', 'service', 'services']

EXCLUDE_DIRS = {
    '.git', '.svn', '.hg', '.idea', '.vscode', '.settings', '.history',
    'node_modules', 'target', 'dist', 'build', 'out', 'bin',
    '__pycache__', 'coverage', 'tmp', 'temp', 'logs', 'venv', 'env',
    'storage', '.docs'
}

TECH_MAP = {
    '.java': 'Java', '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript',
    '.jsx': 'React', '.tsx': 'React', '.vue': 'Vue',
    '.go': 'Go', '.rs': 'Rust', '.kt': 'Kotlin',
}


def scan_modules(root_path: str):
    root = Path(root_path).resolve()
    
    is_maven = (root / 'pom.xml').exists()
    is_gradle = (root / 'build.gradle').exists() or (root / 'build.gradle.kts').exists()
    
    modules = []
    
    for item in sorted(root.iterdir()):
        if not item.is_dir() or item.name in EXCLUDE_DIRS or item.name.startswith('.'):
            continue
        
        if is_container_module(item):
            modules.extend(extract_sub_modules(item, root))
        else:
            m = analyze_module(item, root)
            if m:
                modules.append(m)
    
    # 全局统计
    total_files, total_size = 0, 0
    all_exts = Counter()
    
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            p = Path(r) / f
            total_files += 1
            try:
                total_size += p.stat().st_size
                if p.suffix in TECH_MAP:
                    all_exts[p.suffix] += 1
            except:
                pass
    
    tech_stack = [{'name': TECH_MAP.get(ext, ext), 'count': count} 
                  for ext, count in all_exts.most_common(5)]
    
    return {
        'project_name': root.name,
        'root_path': str(root),
        'project_type': 'maven' if is_maven else ('gradle' if is_gradle else 'unknown'),
        'tech_stack': tech_stack,
        'stats': {
            'total_modules': len(modules),
            'total_files': total_files,
            'total_size': total_size,
            'size_human': f"{total_size / 1024 / 1024:.1f} MB"
        },
        'modules': modules
    }


def is_container_module(module_path: Path) -> bool:
    name_lower = module_path.name.lower()
    for keyword in CONTAINER_KEYWORDS:
        if keyword in name_lower:
            if list(module_path.glob('*/pom.xml')):
                return True
    return False


def extract_sub_modules(container_path: Path, root: Path) -> list:
    sub_modules = []
    parent_name = container_path.name
    
    for item in sorted(container_path.iterdir()):
        if not item.is_dir() or item.name in EXCLUDE_DIRS or item.name.startswith('.'):
            continue
        
        if (item / 'pom.xml').exists() or (item / 'build.gradle').exists():
            m = analyze_module(item, root)
            if m:
                m['parent'] = parent_name
                sub_modules.append(m)
    
    return sub_modules


def analyze_module(module_path: Path, root: Path) -> dict:
    is_maven = (module_path / 'pom.xml').exists()
    is_gradle = (module_path / 'build.gradle').exists()
    is_npm = (module_path / 'package.json').exists()
    
    if not (is_maven or is_gradle or is_npm):
        # 文档类目录也作为模块
        if module_path.name in ['docs', 'sql', 'deploy', 'scripts']:
            module_type = 'docs'
        else:
            return None
    else:
        module_type = 'java' if (is_maven or is_gradle) else 'frontend'
    
    # 统计文件
    file_count = 0
    code_files = []
    
    for r, dirs, files in os.walk(module_path):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            file_count += 1
            p = Path(r) / f
            if p.suffix in TECH_MAP:
                code_files.append(str(p.relative_to(module_path)))
    
    ext_counter = Counter(Path(f).suffix for f in code_files)
    primary_tech = TECH_MAP.get(ext_counter.most_common(1)[0][0], 'N/A') if ext_counter else 'N/A'
    
    return {
        'name': module_path.name,
        'path': str(module_path.relative_to(root)),
        'type': module_type,
        'tech': primary_tech,
        'file_count': file_count,
        'code_file_count': len(code_files),
        # 不再猜测职责，由 AI 填写
        'role': '',
        'description': ''
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('path')
    parser.add_argument('-o', '--output', default='modules.json')
    args = parser.parse_args()
    
    data = scan_modules(args.path)
    
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"[OK] {data['stats']['total_modules']} modules -> {args.output}")
