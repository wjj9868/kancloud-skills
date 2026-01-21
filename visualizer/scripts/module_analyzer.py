#!/usr/bin/env python3
"""
模块分析器 V4 - 只生成骨架，内容由 AI 填充
"""

import json
import os
import argparse
from pathlib import Path


def generate_module_docs(modules_json: str, output_dir: str):
    """为每个模块生成空骨架文档"""
    
    with open(modules_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    root_path = Path(data['root_path'])
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # 生成快速启动骨架（内容由 AI 填充）
    quickstart = f"""# 快速启动指南

> 本指南帮助你在本地环境运行 **{data['project_name']}** 项目。

## 环境要求

<!-- AI_FILL: 读取 pom.xml 确定 JDK 版本，读取 package.json 确定 Node 版本 -->

## 数据库配置

<!-- AI_FILL: 读取 application.yml 找到数据库配置 -->

## 后端启动

<!-- AI_FILL: 读取 pom.xml 和启动类确定启动方式 -->

## 前端启动

<!-- AI_FILL: 读取 package.json 确定启动命令 -->

## 常见问题

<!-- AI_FILL: 基于配置和代码推断可能的问题 -->
"""
    (output_path / 'QUICKSTART.md').write_text(quickstart, encoding='utf-8')
    print("  [OK] QUICKSTART.md (skeleton)")
    
    # 生成各模块骨架
    for module in data['modules']:
        parent_info = f"（父模块：{module.get('parent', '根目录')}）" if module.get('parent') else ""
        
        content = f"""# {module['name']}

> **类型**：{get_type_label(module['type'])} | **技术栈**：{module['tech']} | **文件数**：{module['file_count']} {parent_info}

## 模块概述

<!-- AI_FILL: 阅读代码后填写真实职责 -->

## 设计要点

### 核心功能

<!-- AI_FILL: 阅读 Controller 后列出真实接口 -->

### 关键类说明

<!-- AI_FILL: 阅读核心类后填写 -->

### 数据流向

<!-- AI_FILL: 基于代码分析填写 -->

### 开发注意事项

<!-- AI_FILL: 基于代码发现的注意点 -->

## 包结构

<!-- AI_FILL: 读取目录结构后填写 -->

## 依赖关系

<!-- AI_FILL: 读取 pom.xml 后填写 -->
"""
        
        md_file = output_path / f"{module['name']}.md"
        md_file.write_text(content, encoding='utf-8')
        print(f"  [OK] {module['name']}.md (skeleton)")
    
    # 生成索引
    index = f"""# {data['project_name']} - 模块索引

> **项目类型**：{data['project_type'].upper()} | **模块数**：{data['stats']['total_modules']} | **总文件数**：{data['stats']['total_files']}

## 模块列表

| 模块 | 类型 | 状态 |
|------|------|------|
"""
    for module in data['modules']:
        index += f"| {module['name']} | {get_type_label(module['type'])} | 待分析 |\n"
    
    (output_path / 'INDEX.md').write_text(index, encoding='utf-8')
    print("  [OK] INDEX.md")
    
    return len(data['modules'])


def get_type_label(module_type: str) -> str:
    labels = {'java': 'Java 后端', 'frontend': '前端', 'docs': '文档'}
    return labels.get(module_type, '其他')


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('-i', '--input', required=True)
    parser.add_argument('-o', '--output', default='.docs')
    args = parser.parse_args()
    
    print("Generating skeletons...")
    count = generate_module_docs(args.input, args.output)
    print(f"\n[OK] Generated {count + 2} skeleton files")
    print("[WARN] All <!-- AI_FILL --> sections need AI to fill with real content")
