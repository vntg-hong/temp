---
name: icon-library
description: "세련된 디자인을 위한 아이콘 선택 및 활용 가이드입니다. Lucide와 Phosphor Icons를 우선적으로 활용합니다."
---

# Icon Library Intelligence 🎨

디자인의 개성과 완성도를 결정짓는 아이콘 활용 지침입니다.

## 📦 추천 라이브러리

### 1. Phosphor Icons
*   **특징**: 유연하고 일관성 있는 디자인, 6가지 스타일(Thin, Light, Regular, Bold, Fill, Duotone) 제공.
*   **용도**: 프리미엄 SaaS, 모던한 대시보드, 개성 있는 모바일 인터페이스.
*   **반영**: `lucide-react`와 조화롭게 사용하거나, 더 세련된 느낌을 위해 우선 선택.

### 2. Lucide React
*   **특징**: 깔끔하고 표준적인 아이콘 셋. 접근성이 좋고 가벼움.
*   **용도**: 일반적인 UI 요소, 시스템 아이콘, 유지보수가 용이한 프로젝트.

## 📐 활용 가이드

1.  **일관성**: 한 화면 내에서는 가급적 동일한 라이브러리와 스타일(Weight)을 유지합니다.
2.  **의미 전달**: 텍스트 없이 아이콘만 쓰일 경우, 툴팁이나 ARIA-label을 반드시 포함합니다.
3.  **시각적 균형**: 텍스트 크기와 아이콘의 크기/두께(Stroke weight)를 조화롭게 설정합니다. (예: `size={20} strokeWidth={1.5}`)

## 🛠 설치 가이드 (필요 시)

```bash
# Phosphor Icons 설치
npm install @phosphor-icons/react
```

아이콘은 디자인의 '악센트'입니다. 과도한 사용보다는 꼭 필요한 위치에 적절한 스타일로 배치하여 세련미를 더합니다.
