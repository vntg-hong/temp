# 안드로이드 앱(APK) 및 로고 설정 가이드

이 문서는 웹으로 제작된 환율 계산기 프로젝트를 안드로이드 앱(APK)으로 빌드하고, 앱 로고 및 누끼 처리된 아이콘을 설정하는 방법을 설명합니다.

---

## 1. 초기 환경 설정 (이미 완료됨)

프로젝트에는 이미 **Capacitor**가 설치되어 안드로이드 플랫폼이 추가되어 있습니다.

- **핵심 도구**: Capacitor (React 웹을 네이티브 앱으로 변환)
- **안드로이드 소스 위치**: `client/android`

---

## 2. 안드로이드 스튜디오 실행

앱을 빌드하고 아이콘을 설정하려면 **Android Studio**가 설치되어 있어야 합니다.

1. 터미널(또는 CMD)에서 `client` 폴더로 이동합니다.
2. 아래 명령어를 입력하여 안드로이드 스튜디오를 실행합니다.
   ```powershell
   cd client
   npx cap open android
   ```

---

## 3. 앱 로고 및 아이콘 설정 (누끼 작업 포함)

안드로이드의 **Image Asset Studio** 기능을 사용하면 배경이 제거된(누끼) 깔끔한 아이콘을 자동으로 생성할 수 있습니다.

1. **Asset Studio 열기**:
   - 안드로이드 스튜디오 왼쪽 프로젝트 창에서 `app` 폴더를 마우스 우클릭합니다.
   - `New` > `Image Asset`을 클릭합니다.

2. **포어그라운드 레이어 (Foreground Layer) 설정**:
   - **Source Asset**의 **Path** 아이콘을 눌러 준비한 로고 이미지 파일을 선택합니다.
   - **Scaling**: `Resize` 슬라이더를 조절하여 로고가 안전 영역(원형 가이드) 안에 적절히 들어가도록 크기를 조정합니다.

3. **백그라운드 레이어 (Background Layer) 설정**:
   - 배경이 투명하거나 색상을 넣고 싶다면 `Asset Type`을 **Color**로 선택합니다.
   - 배경색을 흰색(`#FFFFFF`) 또는 로고와 어울리는 색상으로 지정하면 누끼를 딴 것과 같은 효과를 볼 수 있습니다.

4. **생성 완료**:
   - `Next` 버튼을 누르고 `Finish`를 클릭하면 모든 해상도(hdpi, xxhdpi 등)의 아이콘이 자동으로 생성되어 적용됩니다.

---

## 4. APK 파일 빌드 및 생성

1. **빌드 메뉴 접속**:
   - 안드로이드 스튜디오 상단 메뉴에서 `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`/ 'Build > Generate App Bundles or APKs>Build APK(s)'를 클릭합니다.

2. **파일 확인**:
   - 빌드가 완료되면 오른쪽 하단에 `Build APK(s): APK(s) generated successfully` 팝업이 뜹니다.
   - 여기서 `locate` 글자를 클릭하면 생성된 `app-debug.apk` 파일 위치가 열립니다.

3. **설치**:
   - 해당 APK 파일을 안드로이드 폰으로 옮겨서 설치합니다. (출처를 알 수 없는 앱 설치 허용 필요)

---

## 5. 코드 수정 후 앱에 반영하기 (Sync)

웹(React) 코드를 수정한 뒤 다시 앱으로 빌드하려면 아래 과정을 거쳐야 합니다.

1. **웹 코드 빌드**:
   ```powershell
   npm run build
   ```
2. **안드로이드 프로젝트 동기화**:
   ```powershell
   npx cap sync
   ```
3. 이후 안드로이드 스튜디오에서 다시 **Build APK**를 수행하면 최신 코드가 반영된 앱이 생성됩니다.

---

## 💡 팁
- **앱 이름 변경**: `client/android/app/src/main/res/values/strings.xml` 파일에서 `app_name` 값을 수정하면 됩니다.
- **패키지 명**: 현재 설정된 패키지 명은 `com.hong.currencycalc` 입니다.
