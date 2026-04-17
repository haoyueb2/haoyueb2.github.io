---
title: LLM 的第一步：BPE 分词器到底在干什么
description: 跟着 Stanford CS336 和 diy-llm Chapter 2 理解分词器。从"为什么需要分词"到"BPE 算法怎么工作"，再到动手实现核心代码。
date: 2026-04-15
tags:
  - cs336
  - LLM
draft: false
translationKey: cs336-bpe-tokenizer
---

大模型不认字。无论是 GPT-4 还是 DeepSeek，它们看到的输入不是文本，而是一串数字。**分词器（Tokenizer）就是把人类的文字翻译成模型能理解的数字序列的那个东西。**

最近在跟 [Stanford CS336](https://stanford-cs336.github.io/spring2025/) 和 [diy-llm](https://github.com/datawhalechina/diy-llm) 学大模型基础。Chapter 2 讲分词器，这篇文章整理一下这章的核心内容。

## 一、文本切成数字，有几种切法？

最直觉的问题：一段文字怎么变成数字？不同的切法差异巨大。

### 字符级分词

把每个字符当一个 token。英文就是 26 个字母 + 符号，中文就是一个汉字一个 token。

```
"Hello" → [H, e, l, l, o] → 5 个 token
```

**好处**：词表极小，永远不会遇到不认识的字。**坏处**：序列太长。一句话可能变成几十上百个 token，而 Transformer 的注意力机制计算量和序列长度的平方成正比（O(n²)），这直接导致计算量爆炸。单个字符也没有什么语义信息，模型需要更深的网络才能理解。

### 字节级分词

更底层——直接按 UTF-8 字节切。英文字母 1 字节，中文 3 字节，emoji 4 字节。词表固定 256（0x00 到 0xFF），能覆盖任何语言和符号。

```
"你好" → [0xE4, 0xBD, 0xA0, 0xE5, 0xA5, 0xBD] → 6 个 token
```

完全不存在 OOV（词表外）问题，但序列比字符级更长。**实际上字节级分词的压缩率恒等于 1**——每个字节就是一个 token，没有任何压缩。

### 词级分词

按空格和标点切成完整的词，每个词分配一个 ID。

```
"I like Datawhale." → [I, like, Datawhale, .] → 4 个 token
```

序列短、语义完整，但词表会爆炸（英语中 look / looks / looked / looking 各占一个位置），而且遇到没见过的词（比如新造词、人名）只能标记为 `<UNK>`，信息直接丢失。

### BPE（Byte Pair Encoding）

**目前 90% 以上的现代 LLM 用的方案。** 核心思路：从字节或字符出发，统计语料中哪些相邻的 pair 出现频率最高，把它们合并成一个新 token。反复迭代，直到词表达到目标大小。

```
"Hello" → [Hell, o] → 2 个 token
```

它自动在字符级和词级之间找到平衡——高频的词会被整体保留（比如 `the`），低频的词会被拆成有意义的子词片段（比如 `un` + `break` + `able`）。

四种方案放一起比较：

| 分词方式 | 词表大小 | OOV 问题 | 序列长度 | 代表模型 |
|---------|---------|---------|---------|---------|
| 字符级 | 小（~几千） | 无 | 很长 | Char-RNN |
| 字节级 | 极小（256） | 无 | 最长 | - |
| 词级 | 极大（>100k） | 严重 | 短 | Word2Vec |
| **BPE** | **适中（30k-100k）** | **极少** | **适中** | **GPT-4, LLaMA, DeepSeek** |

## 二、BPE 算法：手动走一遍

BPE 的训练过程没有任何高等数学，就是贪心统计。

### 三步循环

```
1. 初始化：把文本拆成最小单位（字节）
2. 统计所有相邻 pair 的出现频率
3. 找到频率最高的 pair，合并成新 token
重复 2-3，直到词表达到目标大小
```

### 具体例子

用 `"the cat sat on the mat. the cat ate the rat."` 来走一遍：

初始时每个字节都是一个独立的 token。第一轮统计相邻 pair 频率后发现 `(a, t)` 出现了 6 次（因为 cat、sat、rat 各出现两次），这是最高频的 pair，于是合并 `a + t → at`。

接下来 `(e, ' ')` 成为最高频，合并为 `e `。然后 `t + h → th`，`th + e  → the `... 这样一路合并下去。

实际跑出来的前 5 条合并规则：

```
第1次: 'a' + 't' → 'at'       （cat/sat/rat 贡献了 6 次）
第2次: 'e' + ' ' → 'e '
第3次: 't' + 'h' → 'th'
第4次: 'th' + 'e ' → 'the '
第5次: 'at' + ' ' → 'at '
```

注意第 1 次合并的不是 `t + h`（虽然直觉上 `the` 是最常见的词），而是 `a + t`。**BPE 完全是数据驱动的，只看频率，不看"语义上像不像一个词"。** 换一份语料，合并顺序就完全不同。这也是为什么不同 LLM 的 tokenizer 不能混用——它们学到的合并规则不一样。

### 编码和解码

训练完成后，得到两样东西：

- **vocab**：token ID 到字节的映射（初始 256 个字节 + 每次合并新增一个）
- **merges**：合并规则列表，按训练时的顺序排列

**编码**就是"回放"合并规则：先把文本拆成字节，然后按 merges 的顺序依次检查是否有可合并的 pair。**解码**就是把 token ID 查 vocab 表拿到对应的字节，拼起来。

以 `"the cat sat"` 为例，经过 20 次合并训练后：

```
原始: 11 字节 → 编码后: 3 tokens
压缩率: 3.67x
解码后和原文完全一致（可逆）
```

## 三、核心代码实现

BPE 训练的核心代码意外地短，整个循环不到 15 行：

```python
def train_bpe(text, num_merges):
    # 把文本转成字节列表作为初始 token 序列
    token_sequences = [list(text.encode("utf-8"))]
    # 初始词表：256 个字节各占一个位置
    vocab = {i: bytes([i]) for i in range(256)}
    merges = []

    for i in range(num_merges):
        # 统计所有相邻 pair 的频率
        pair_counts = get_pair_counts(token_sequences)
        if not pair_counts:
            break
        # 找到频率最高的 pair
        max_pair = max(pair_counts, key=pair_counts.get)
        # 新 token 的 ID 从 256 开始递增
        new_id = 256 + i
        merges.append(max_pair)
        # 新 token 的内容 = 两个旧 token 的字节拼接
        vocab[new_id] = vocab[max_pair[0]] + vocab[max_pair[1]]
        # 在所有序列中执行合并
        token_sequences = merge_pair(token_sequences, max_pair, new_id)

    return vocab, merges
```

其中 `merge_pair` 本质上就是**数组版的字符串替换**——遍历序列，遇到匹配的 pair 就替换成新 token ID。理解了这一点，整个算法就没有什么神秘的了。

## 四、从 BPE 到真实的 LLM 分词器

上面的实现是最简版，实际用在 GPT-4 / LLaMA / DeepSeek 里的分词器还多了几层工程：

**预分词（Pre-tokenization）**：在做 BPE 之前，先用正则表达式把文本粗切一刀。比如 GPT-2 用一个复杂的正则把文本按空格、标点、数字等边界切开，BPE 只在每个片段内部做合并，不会跨片段。这避免了 `the` 和前一个词的最后一个字母被合并这种不合理的情况。

**字节级 BPE（BBPE）**：GPT-2 以来的主流方案。不从字符出发，而是从 UTF-8 字节出发。好处是初始词表只有 256，能处理任何语言和 emoji，彻底消灭 OOV 问题。

**特殊 token**：`<|endoftext|>`、`<|pad|>` 这类控制 token 在训练时被保护，不参与合并，保证它们始终是单独一个 token。实际应用中，它们的 ID 通常被优先分配（比如 `<|endoftext|>` 的 ID 是 0）。

**大规模语料的工程优化**：训练 TB 级语料时不可能单机统计所有 pair 频率，需要分布式统计、分块并行等手段。Assignment 1 的 notebook 里那个 `find_chunk_boundaries` 函数就是在解决这个问题——大文件不能随便切，要在 `<|endoftext|>` 分隔符处切断，避免把一个故事切成两半。

## 五、主流 LLM 都用什么分词器

| 模型 | 分词方案 | 本质 |
|------|---------|------|
| GPT-2 / 3 / 4 | tiktoken | 字节级 BPE |
| LLaMA / DeepSeek | SentencePiece (BPE 模式) | 字节级 BPE |
| BERT | WordPiece | BPE 的近亲（合并策略基于似然而非频率） |
| T5 / Gemma | SentencePiece (Unigram 模式) | 概率模型，不是 BPE |

除了 T5 系之外，几乎全是 BPE 或 BPE 变种。

WordPiece 和 BPE 的区别在于"怎么选下一个合并"——BPE 选频率最高的 pair，WordPiece 选能最大提升语料似然的 pair。Unigram 则反过来，从一个大词表开始裁剪，保留概率最高的 token。但在工程实践中，BPE 因为实现简单、效果够好，占据了绝对主流。

## 六、一些容易忽略的点

**分词器的训练独立于模型训练。** 它不涉及神经网络和梯度下降，纯粹是统计算法。但它的输出直接决定了模型看到的世界长什么样——切得好，模型学得高效；切得差（比如中文被碎片化成单字节），模型在对应语言上表现就会差。

**词表大小是个 trade-off。** 词表大，同样的文本被压缩成更少的 token，推理更快，但 embedding 矩阵更大、低频 token 的表示不够充分。GPT-2 用 50257，LLaMA 用 32000，DeepSeek 用 100000+，没有标准答案，取决于目标语言覆盖和模型规模。

**多语言场景下的语料平衡很重要。** 如果训练语料 90% 是英文，BPE 学到的 merge 规则会严重偏向英文。中文、韩文等语言的常见子串进不了高频统计，最终词表里它们被切得很碎，编码效率低，下游任务表现也差。所以训练多语言分词器时通常要对低资源语言做过采样。

**压缩率是最直观的评估指标。** 同一段文本，token 数越少说明分词器压缩效率越高。这意味着在固定的上下文窗口长度下，模型能"看到"更多实际内容。

---

这章的动手部分我是跟着 CS336 Assignment 1 的思路，从零写了一个 BPE 训练循环（不用 HuggingFace 库）。过程中最大的感受是：BPE 算法本身真的很简单，就是贪心地合并高频 pair，核心代码不到 15 行。但正是这个简单的算法支撑了几乎所有现代 LLM 的第一步。

下一篇准备写 Transformer 架构（Chapter 3-4），那部分数学会多一些。
