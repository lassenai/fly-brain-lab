# 초파리 뇌로 로봇을 조종하기 — L@SSEN AI 오픈소스

2026년 9월 공개된 수컷 초파리 뇌 배선(MaleCNS, 뉴런 166,700개)을 웹 브라우저에서 물통(LIF) 모델로 구동하고, 그 출력으로 로봇 개·로봇 싸커 킷·오리·휴머노이드·2D 초파리를 움직이는 웹 기반 신경과학 & 로보틱스 실험실입니다. 

전부 사용자의 기기 안(브라우저)에서 계산되며, 별도의 서버나 계정이 필요 없습니다. **이 뇌는 학습하지 않습니다.** 걸음과 균형은 각 로봇이 강화학습으로 배운 공개 정책이 만들고, 초파리 뇌는 방향 및 자극 반응을 결정합니다.

> 💡 **안내:** 본 저장소는 **CONNECT AI LAB (AI 멘토 제이)**의 원본 오픈소스 프로젝트를 바탕으로 **L@SSEN AI**에서 웹 호스팅 및 브랜딩 환경을 업데이트한 라이브러리입니다.

---

## 🌐 웹에서 바로 실행하기 (온라인 라이브)

별도의 프로그램 설치 없이 웹 브라우저 접속만으로 즉시 시뮬레이터를 실행할 수 있습니다:

👉 **[L@SSEN AI 초파리 뇌 시뮬레이터 메인 런처](https://lassenai.github.io/fly-brain-lab/)**

| 프로그램 | 무엇을 하는가 | 바로 보기 링크 |
|---|---|---|
| 🪰 **fly-walk** | 초파리 뇌 걷기 — 2D 초파리 + 실시간 3D 뇌 신경망 발화 시뮬레이션 | [바로 실행](https://lassenai.github.io/fly-brain-lab/fly-walk/) |
| 🤖 **fly-bodies** | 한 뇌, 여러 몸 — 유니트리 Go1 로봇 개 · 로봇 싸커 킷 · 마이크로덕 · 유니트리 G1 휴머노이드 (MuJoCo WASM + ONNX) | [바로 실행](https://lassenai.github.io/fly-brain-lab/fly-bodies/dist/) |
| 🦆 **fly-duck** | FlyWire vs MaleCNS 커넥톰 멀티-브레인 시뮬레이션 — 2024 암컷 vs 2026 수컷 뇌 배선 비교 관찰 | [바로 실행](https://lassenai.github.io/fly-brain-lab/fly-duck/compare.html) |

---

## 📁 저장소 폴더 구조

```
fly_brain_lab/
├── index.html               # GitHub Pages 메인 접속 랜딩 및 시뮬레이터 런처
├── fly-walk/                # 2D 초파리 + 3D 뇌 실시간 시뮬레이터 (정적 HTML/JS)
├── fly-bodies/              # 한 뇌, 여러 몸 3D 물리 시뮬레이터 (Vite / MuJoCo WebGL)
│   └── dist/                # 웹 실행용 정적 빌드 결과물
├── fly-duck/                # 마이크로덕 실험실 & 두 뇌 비교 (compare.html)
├── scripts/
│   └── build_male.py        # MaleCNS 원본 표 3개 → 브라우저용 12MB 그래프 변환 스크립트
├── THIRD_PARTY_NOTICES.md   # 제3자 저작물 및 라이선스 고지
├── LICENSE                  # Apache 2.0 라이선스
└── README.md                # 저장소 안내 문서
```

---

## 💻 로컬 PC에서 실행하는 방법

### 1. Python 내장 웹 서버로 실행 (가장 간단함)
PowerShell 또는 터미널을 열고 저장소 루트 폴더에서 다음 명령어를 실행합니다:

```bash
python -m http.server 8000
```
실행 후 웹 브라우저 주소창에 **`http://localhost:8000`** 을 입력하면 메인 런처 화면이 열립니다.

### 2. Node.js 개발 서버로 실행 (`fly-bodies` 소스 수정 시)
```bash
cd fly-bodies
npm ci
npm run dev
```
출력되는 **`http://localhost:5173`** 주소를 브라우저에서 엽니다.

### 3. 수컷 뇌 그래프 다시 빌드하기 (`scripts/build_male.py`)
```bash
python3 -m venv env && env/bin/pip install pyarrow numpy scipy
# https://male-cns.janelia.org/download/ 에서 body-annotations, body-neurotransmitters, connectome-weights feather 파일 3개를 받아 같은 폴더에 두고 실행
env/bin/python scripts/build_male.py
```

---

## 💡 주요 특징 및 작동 원리

- **진짜 뇌 배선 지도 (CC-BY 4.0):** 구글 리서치 및 자넬리아 연구소가 공개한 MaleCNS v1.0(뉴런 166,700개) 배선 지도를 기반으로 시냅스 10개 이상 연결을 추출해 구성했습니다.
- **물통(LIF) 모델 계산:** 냄새 자극이 주어지면 촉각엽(ALPN) → 하강뉴런(DN) → 척수 운동뉴런으로 신호가 전달되는 과정을 단순화된 LIF 모델로 직관적으로 시각화합니다.
- **강화학습 물리 정책:** 로봇의 보행과 균형 잡기는 MuJoCo 물리 엔진과 ONNX 기반 강화학습 정책이 담당하고, 초파리 뇌는 방향(좌/우) 명령 신호를 전달합니다.

---

## 📄 라이선스 및 저작권

- **L@SSEN AI** 코드는 Apache-2.0 라이선스입니다 (`LICENSE`).
- 본 프로젝트는 **CONNECT AI LAB (AI 멘토 제이)**의 원본 오픈소스 프로젝트를 기반으로 구현되었습니다.
- 바탕이 된 `microfly`(Apache-2.0), `Pollen Robotics MicroDuck`(Apache-2.0), `MuJoCo Menagerie`(BSD-3), `MuJoCo Playground`(Apache-2.0), `MaleCNS 뇌 데이터`(CC-BY 4.0) 등 제3자 저작물 고지는 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)를 참조하세요.

---

## 👤 제작

- **L@SSEN AI** (Link, AI, Solution · Physical AI Laboratory)
- **기반 프로젝트:** CONNECT AI LAB
