# Obsidian to Notion

옵시디언에서 쓴 노트를 **버튼 하나로 노션에 올리는** 옵시디언 플러그인입니다.
이미지도 같이 올라가고, 같은 노트를 다시 올리면 새 페이지를 만들지 않고 기존 노션 페이지를 업데이트합니다.

- [주요 기능](#주요-기능)
- [노션 준비하기 (공통)](#1-노션-준비하기-공통)
- [설치하기 — macOS](#2-설치하기--macos)
- [설치하기 — Windows](#2-설치하기--windows)
- [설치하기 — Linux](#2-설치하기--linux)
- [설치하기 — iPhone · iPad · Android](#2-설치하기--iphone--ipad--android)
- [플러그인 켜고 설정하기 (공통)](#3-플러그인-켜고-설정하기-공통)
- [사용법](#4-사용법)
- [업데이트 · 삭제](#업데이트--삭제)
- [문제 해결](#문제-해결)
- [개발하기](#개발하기)

---

## 주요 기능

- 명령 팔레트, 왼쪽 리본 버튼, 파일 우클릭 메뉴에서 **"Notion에 올리기"**
- 노션 **데이터베이스**에 올리면 행(항목)으로, **일반 페이지**에 올리면 하위 페이지로 들어감
- 처음 올린 뒤 노트 frontmatter에 `notion_id`, `notion_url`을 저장 → 다시 올리면 **기존 페이지를 업데이트**
- 보관함의 **이미지·PDF를 노션에 직접 업로드** (`![[사진.png]]`, `![](사진.png)`)
- frontmatter의 `tags`를 노션 데이터베이스의 Multi-select 속성으로 옮김
- 데스크톱(macOS · Windows · Linux)과 모바일 모두 동작

### 변환되는 마크다운

| 옵시디언 | 노션 |
|---|---|
| `# 제목` ~ `###### 제목` | 제목 1 ~ 3 (4단계 이하는 제목 3) |
| 문단, `**굵게**`, `*기울임*`, `~~취소선~~`, `` `코드` ``, `[링크](https://…)` | 텍스트 + 서식 |
| `- 항목`, `1. 항목`, `- [ ] 할 일` | 글머리 기호 / 번호 / 할 일 목록 (3단계까지 들여쓰기) |
| `> 인용`, `> [!tip] 콜아웃` | 인용 / 콜아웃(이모지 아이콘) |
| ```` ```js ```` 코드블록 | 코드 블록 (언어 지정) |
| 표 | 표 |
| `$$ 수식 $$` | 수식 블록 |
| `---` | 구분선 |
| `![[이미지.png]]`, `![](이미지.png)` | 이미지 업로드 (PDF는 PDF 블록) |
| `![](https://…/이미지.png)` | 외부 이미지 |

### 아직 안 되는 것

- `[[위키링크]]`는 노션 링크가 아닌 일반 글자로 바뀝니다.
- `==하이라이트==`는 굵은 글씨로 바뀝니다.
- 노션 → 옵시디언 방향(양방향 동기화)은 지원하지 않습니다.
- 노션 **무료 플랜은 파일당 5MB**까지만 업로드됩니다(유료 20MB). 올리지 못한 파일은 `📎 첨부: 파일명`으로 남고, 끝나면 알림으로 알려줍니다.
- 이미지 업로드 지원 형식: png, jpg, jpeg, gif, webp, svg, heic, tif, tiff, ico, pdf

---

## 1. 노션 준비하기 (공통)

운영체제와 상관없이 한 번만 하면 됩니다.

1. [notion.so/profile/integrations](https://www.notion.so/profile/integrations)에서 **새 연결(Integration) 만들기**
   - 종류: **내부(Internal)**
   - 기능: **콘텐츠 읽기 · 업데이트 · 삽입**에 체크
2. 만들어진 연결의 **API 토큰**(`ntn_...`)을 복사해 둡니다.
   > ⚠️ 토큰은 비밀번호와 같습니다. 블로그, 깃허브, 채팅 등에 올리지 마세요.
3. 노트를 올릴 노션 **페이지 또는 데이터베이스**를 만듭니다.
4. 연결 설정의 **콘텐츠 사용 권한** 탭에서 그 페이지를 추가합니다.
   (또는 노션 페이지 오른쪽 위 `•••` → **연결** → 방금 만든 연결 추가)
5. 그 페이지의 링크를 복사해 둡니다. (`•••` → **링크 복사**)

> 💡 태그도 옮기고 싶다면 **데이터베이스**를 만들고 `Tags`라는 이름의 **Multi-select** 속성을 추가하세요.

---

## 2. 설치하기 — macOS

설치 방법은 두 가지입니다. **방법 A**는 프로그램 설치가 필요 없어서 가장 쉽습니다.

### 방법 A. ZIP으로 받아서 복사하기 (추천)

1. 이 저장소 페이지에서 초록색 **Code** 버튼 → **Download ZIP**을 누릅니다.
2. 다운로드 폴더에서 ZIP 파일을 더블클릭해 압축을 풉니다.
3. **Finder**에서 옵시디언 보관함(vault) 폴더를 엽니다.
   - 보관함 위치를 모르겠다면: 옵시디언에서 아무 노트나 우클릭 → **Finder에서 보기**
4. `.obsidian` 폴더는 숨김 폴더입니다. Finder에서 **`Cmd + Shift + .`** 을 누르면 보입니다.
5. `.obsidian` 안에 `plugins` 폴더가 없으면 만들고, 그 안에 `obsidian-to-notion` 폴더를 만듭니다.
6. 압축을 푼 폴더에서 아래 **3개 파일**을 `obsidian-to-notion` 폴더에 복사합니다.
   ```
   main.js
   manifest.json
   styles.css
   ```

완성된 모양:
```
내 보관함/
└── .obsidian/
    └── plugins/
        └── obsidian-to-notion/
            ├── main.js
            ├── manifest.json
            └── styles.css
```

### 방법 B. 터미널로 받아서 설치하기

**터미널** 앱을 열고 아래를 차례로 실행합니다. `"/Users/나/Documents/내보관함"` 부분은 내 보관함 경로로 바꿔 주세요.

```bash
git clone https://github.com/devedevina/obsidian_to_notion.git
```

```bash
cd obsidian_to_notion
```

```bash
VAULT="/Users/나/Documents/내보관함"; mkdir -p "$VAULT/.obsidian/plugins/obsidian-to-notion" && cp main.js manifest.json styles.css "$VAULT/.obsidian/plugins/obsidian-to-notion/"
```

> 💡 보관함 경로는 Finder에서 보관함 폴더를 터미널 창으로 끌어다 놓으면 자동으로 입력됩니다.
> iCloud에 있는 보관함은 보통 `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/보관함이름` 입니다.

`git`이 없다는 메시지가 나오면 안내 창에서 **설치**를 누르거나, 방법 A를 사용하세요.

설치가 끝나면 [3. 플러그인 켜고 설정하기](#3-플러그인-켜고-설정하기-공통)로 가세요.

---

## 2. 설치하기 — Windows

### 방법 A. ZIP으로 받아서 복사하기 (추천)

1. 이 저장소 페이지에서 초록색 **Code** 버튼 → **Download ZIP**을 누릅니다.
2. 다운로드한 ZIP 파일을 우클릭 → **압축 풀기**를 누릅니다.
3. **파일 탐색기**에서 옵시디언 보관함 폴더를 엽니다.
   - 보관함 위치를 모르겠다면: 옵시디언에서 아무 노트나 우클릭 → **시스템 탐색기에서 보기**
4. `.obsidian` 폴더가 안 보이면 탐색기 위쪽 **보기 → 표시 → 숨긴 항목**에 체크합니다.
   (Windows 10: **보기** 탭 → **숨긴 항목** 체크)
5. `.obsidian` 안에 `plugins` 폴더가 없으면 만들고, 그 안에 `obsidian-to-notion` 폴더를 만듭니다.
6. 압축을 푼 폴더에서 `main.js`, `manifest.json`, `styles.css` **3개 파일**을 `obsidian-to-notion` 폴더에 복사합니다.

> ⚠️ 탐색기가 파일 확장자를 숨기고 있으면 `main.js`가 `main`으로만 보일 수 있습니다. 이름을 바꾸지 말고 그대로 복사하면 됩니다.

### 방법 B. PowerShell로 받아서 설치하기

시작 메뉴에서 **PowerShell**을 열고 아래를 차례로 실행합니다. `"C:\Users\나\Documents\내보관함"` 부분은 내 보관함 경로로 바꿔 주세요.

```powershell
git clone https://github.com/devedevina/obsidian_to_notion.git
```

```powershell
cd obsidian_to_notion
```

```powershell
$Vault = "C:\Users\나\Documents\내보관함"; $Dest = "$Vault\.obsidian\plugins\obsidian-to-notion"; New-Item -ItemType Directory -Force -Path $Dest | Out-Null; Copy-Item main.js, manifest.json, styles.css -Destination $Dest
```

`git`이 없다면 [git-scm.com](https://git-scm.com/download/win)에서 설치하거나, 방법 A를 사용하세요.

> 💡 보관함 경로는 탐색기 주소창을 클릭하면 나오는 경로를 복사하면 됩니다.

설치가 끝나면 [3. 플러그인 켜고 설정하기](#3-플러그인-켜고-설정하기-공통)로 가세요.

---

## 2. 설치하기 — Linux

### 방법 A. ZIP으로 받아서 복사하기

1. 이 저장소 페이지에서 **Code** → **Download ZIP**을 누르고 압축을 풉니다.
2. 파일 관리자에서 보관함 폴더를 열고 **`Ctrl + H`** 로 숨김 폴더(`.obsidian`)를 표시합니다.
3. `.obsidian/plugins/obsidian-to-notion` 폴더를 만들고 `main.js`, `manifest.json`, `styles.css`를 복사합니다.

### 방법 B. 터미널로 받아서 설치하기

`~/Documents/내보관함` 부분은 내 보관함 경로로 바꿔 주세요.

```bash
git clone https://github.com/devedevina/obsidian_to_notion.git
```

```bash
cd obsidian_to_notion
```

```bash
VAULT="$HOME/Documents/내보관함"; mkdir -p "$VAULT/.obsidian/plugins/obsidian-to-notion" && cp main.js manifest.json styles.css "$VAULT/.obsidian/plugins/obsidian-to-notion/"
```

> 💡 옵시디언을 **Flatpak**이나 **Snap**으로 설치했다면, 보관함이 있는 폴더에 옵시디언이 접근할 수 있어야 합니다. 보관함을 홈 폴더 안에 두는 것이 가장 간단합니다.

설치가 끝나면 [3. 플러그인 켜고 설정하기](#3-플러그인-켜고-설정하기-공통)로 가세요.

---

## 2. 설치하기 — iPhone · iPad · Android

모바일 옵시디언에서는 파일을 직접 넣기 어려우므로, **컴퓨터에 먼저 설치한 뒤 동기화**하는 방법을 추천합니다.

1. 위의 macOS / Windows / Linux 방법으로 컴퓨터의 보관함에 설치합니다.
2. 보관함을 **iCloud, Obsidian Sync** 등으로 휴대폰과 동기화합니다.
   - Obsidian Sync를 쓴다면 **설정 → 동기화**에서 **설치된 커뮤니티 플러그인** 동기화를 켜세요.
3. 휴대폰 옵시디언에서 [3. 플러그인 켜고 설정하기](#3-플러그인-켜고-설정하기-공통)를 똑같이 진행합니다.

---

## 3. 플러그인 켜고 설정하기 (공통)

1. 옵시디언을 **완전히 종료했다가 다시 엽니다.** (macOS `Cmd + Q`, Windows/Linux 창 닫기)
2. **설정 → 커뮤니티 플러그인 → 제한 모드 끄기**
3. **설치된 플러그인** 목록에서 **Obsidian to Notion**을 켭니다.
   - 목록에 안 보이면 오른쪽의 새로고침 버튼을 누르세요.
4. 왼쪽 설정 메뉴 아래쪽의 **Obsidian to Notion**에 들어가서 입력합니다.

| 항목 | 넣을 값 |
|---|---|
| Notion Integration 토큰 | 노션에서 복사한 `ntn_...` 토큰 |
| 데이터베이스 또는 페이지 링크 | 노트를 올릴 노션 페이지/데이터베이스 링크 (통째로 붙여넣기) |
| 태그 속성 이름 | 태그를 넣을 Multi-select 속성 이름 (기본값 `Tags`, 없으면 건너뜀) |

5. **테스트** 버튼을 눌러 ✅ **연결 성공** 메시지가 뜨면 준비 끝입니다.

> ⚠️ 토큰은 보관함의 `.obsidian/plugins/obsidian-to-notion/data.json`에 저장됩니다.
> 보관함을 Git이나 공유 폴더로 공유한다면 이 파일이 함께 올라가지 않도록 주의하세요.

---

## 4. 사용법

올릴 노트를 열고 아래 중 하나를 실행합니다.

- **명령 팔레트** (`Cmd/Ctrl + P`) → **현재 노트를 Notion에 올리기**
- 왼쪽 **리본의 업로드(☁️) 아이콘**
- 파일 목록에서 노트 **우클릭 → Notion으로 보내기**

올리고 나면 노트 맨 위(frontmatter)에 이렇게 기록됩니다.

```yaml
---
notion_id: 1a2b3c4d-....
notion_url: https://www.notion.so/....
---
```

- 노트를 고친 뒤 다시 올리면 **같은 노션 페이지의 내용이 새 내용으로 바뀝니다.**
- 새 페이지로 따로 올리고 싶다면 `notion_id`, `notion_url` 두 줄을 지우고 올리세요.
- 노션 페이지의 제목은 frontmatter의 `title`이 있으면 그것을, 없으면 파일 이름을 씁니다.

---

## 업데이트 · 삭제

**업데이트**: 새 버전의 `main.js`, `manifest.json`, `styles.css`를 같은 폴더에 덮어쓴 뒤, 플러그인을 껐다 켜거나 옵시디언을 재시작합니다. 방법 B로 설치했다면 저장소 폴더에서 `git pull` 후 복사 명령을 다시 실행하면 됩니다.

**삭제**: **설정 → 커뮤니티 플러그인**에서 Obsidian to Notion 옆의 휴지통 아이콘을 누르거나, `.obsidian/plugins/obsidian-to-notion` 폴더를 지웁니다. 이미 노션에 올라간 페이지는 지워지지 않습니다.

---

## 문제 해결

| 메시지 / 증상 | 원인과 해결 |
|---|---|
| 토큰이 올바르지 않아요 | 토큰을 다시 복사해서 붙여넣으세요. 앞뒤 공백이 없는지 확인하세요. |
| 데이터베이스를 찾을 수 없어요 | 노션 페이지에 연결(Integration)을 추가하지 않았습니다. [1번 4단계](#1-노션-준비하기-공통)를 확인하세요. |
| 고쳤는데 예전처럼 동작해요 | 옵시디언이 예전 플러그인을 계속 쓰고 있습니다. 플러그인을 껐다 켜거나 옵시디언을 재시작하세요. |
| 이미지가 `📎 첨부: 파일명`으로 올라가요 | 파일이 너무 크거나(무료 5MB) 지원하지 않는 형식입니다. 알림에 나온 이유를 확인하세요. |
| 플러그인 목록에 안 보여요 | 폴더 이름이 `obsidian-to-notion`인지, 그 안에 3개 파일이 바로 들어 있는지 확인하세요. (`obsidian-to-notion/obsidian_to_notion-main/main.js`처럼 한 단계 더 들어가 있으면 안 됩니다.) |

더 자세한 오류는 옵시디언 개발자 콘솔(macOS `Cmd + Option + I`, Windows/Linux `Ctrl + Shift + I`)에서 `[obsidian-to-notion]`으로 검색하면 볼 수 있습니다.

---

## 개발하기

[Node.js](https://nodejs.org) 18 이상이 필요합니다.

```bash
npm install
```

```bash
npm run build
```

빌드하면 `main.js`가 새로 만들어집니다. 내 보관함에 바로 설치하려면:

```bash
npm run install-vault -- "/path/to/your/vault"
```

수정하면서 자동으로 다시 빌드하려면 `npm run dev`를 실행하세요.

### 폴더 구조

```
src/
├── main.ts      # 플러그인 본체: 명령, 버튼, 설정 화면, 업로드 흐름, 이미지 업로드
├── markdown.ts  # 마크다운 → 노션 블록 변환기
└── notion.ts    # 노션 API 클라이언트 (requestUrl 사용, 429 재시도, 파일 업로드)
```

### 동작 흐름

```
노트(.md) → markdownToBlocks() → 로컬 이미지 업로드(/v1/file_uploads)
        → 페이지 생성(POST /v1/pages) 또는 업데이트(기존 블록 삭제 후 다시 추가)
        → frontmatter에 notion_id / notion_url 저장
```
