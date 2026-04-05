# 가족 용돈/재테크 프로토타입

브라우저에서 바로 실행 가능한 프로토타입입니다.

## 실행 방법
1. `python3 -m http.server 8000`
2. 브라우저에서 `http://localhost:8000/app/` 접속

## 현재 구현 범위
- 기본 멤버: 나/첫째/둘째
- 멤버 추가
- 거래 입력(용돈 수입/저축/투자)
- 대시보드 KPI
  - 총 용돈 수입
  - 총 저축/투자
  - 저축/투자 비율
  - 평균 투자 수익률
- 일자별 용돈 합계
- 거래 내역 테이블
- 데이터 영속 저장(LocalStorage)

## 다음 단계(실서비스)
- Google 로그인(Firebase Auth)
- 클라우드 DB(Firestore/Supabase)로 동기화
- 가족 공유 권한
- iPhone 앱 배포(Flutter 또는 React Native)
