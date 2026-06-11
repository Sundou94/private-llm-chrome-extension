# Private LLM Assistant — Chrome Extension

회사 내부망의 OpenAI 호환 LLM 서버를 사용하여 웹페이지를 요약하고, RAG 방식으로 질문하고, Markdown 파일로 저장하는 크롬 확장프로그램입니다.

## 특징

- **외부 API 연결 없음** — 사용자가 설정한 내부 서버 주소로만 통신
- **외부 라이브러리 없음** — 모든 코드 자체 구현 (TF-IDF RAG 포함)
- **API Key 보안** — `chrome.storage.local`에만 저장, 외부 전송 없음
- Manifest V3 준수

## 기능

| 탭 | 설명 |
|---|---|
| 📄 요약 | 현재 페이지 본문을 LLM으로 요약 |
| 💬 Q&A | 페이지 내용을 RAG로 청킹 후 관련 구절을 찾아 LLM에 질문 |
| ⬇ 내보내기 | 페이지 HTML을 Markdown으로 변환하여 `.md` 파일로 저장 |

## 설치

1. 이 저장소를 클론하거나 ZIP 다운로드
2. Chrome 주소창에 `chrome://extensions` 입력
3. 우측 상단 **개발자 모드** 활성화
4. **압축해제된 확장프로그램을 로드합니다** 클릭
5. 프로젝트 폴더 선택

## 설정

확장프로그램 설치 후 팝업의 ⚙ 버튼 클릭:

| 항목 | 예시 | 설명 |
|---|---|---|
| Base URL | `http://192.168.1.100:8000` | LLM 서버 주소 (`/v1` 자동 추가) |
| API Key | `sk-internal-...` | 서버 인증 키 |
| 모델 이름 | `gpt-3.5-turbo`, `llama3` | 사용할 모델 |
| 최대 토큰 | `2000` | 응답 길이 제한 |

## 파일 구조

```
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js
├── utils/
│   ├── llm.js       — LLM API 클라이언트
│   ├── rag.js       — TF-IDF 기반 청킹 & 검색
│   └── markdown.js  — HTML → Markdown 변환
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 기술 스택

- **Manifest V3** Chrome Extension
- **ES Modules** (`type="module"`)
- **RAG**: 자체 구현 TF-IDF + 코사인 유사도 (한국어/영어 지원)
- **HTML→MD**: 자체 구현 재귀 DOM 변환기 (표, 코드블록, 리스트 지원)
- **다운로드**: `chrome.downloads` API + Blob URL
