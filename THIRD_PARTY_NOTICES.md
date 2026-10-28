# 第三方来源与授权

## 训练计划

计划结构参考 B 站作者“好人松松”的《健身 Excel 超级套表》。本项目的计划名称、循环日结构和组数规则由该资料整理而来，不包含原表文件。

## 动作数据

- 项目：`hasaneyldrm/exercises-dataset`
- 用途：动作名称、分类、器械、目标肌肉、中文分步说明
- 数据与说明文字：MIT License
- 数据来源：https://github.com/hasaneyldrm/exercises-dataset

## 动作媒体

- 版权：© Gym visual — https://gymvisual.com/
- 媒体以 180×180 原分辨率引用，保留每条动作的 attribution
- 图片与 GIF 不属于 MIT License
- 公开商用或大规模再分发前，需要单独确认 Gym visual 的使用条款与许可

## 设计方法

前端设计流程参考 `Leonxlnx/taste-skill` 的布局、间距、克制配色和真实浏览器验收原则。本项目未复制其代码或组件。

## 产品参考

Fitday 1.1 的功能方向参考了开源项目 **openGym**（https://github.com/DuarteSantos8/openGym）展示的产品思路，包括训练连续性、渐进负荷、个人记录、数据导出和离线使用。

openGym 的代码使用 **AGPL-3.0**。本项目没有复制、改写或分发 openGym 的源代码、样式、插画、身体肌群图或文案；相关功能均按 Fitday 自身的数据模型和界面独立实现。AGPL 的传染范围不适用于本项目的独立实现。

Epley 预估 1RM 属于通用训练数学公式，双进阶属于通用力量训练方法，不作为第三方代码引入。

## 动作中文名称

全部 1,324 个中文动作名称由本项目的 `scripts/localize-exercise-names.py` 使用自有健身术语词表生成，未复制 openGym、其开源翻译文件或其他第三方中文动作名。英文原名同时保留在界面上，方便核对标准术语和器械变式。
