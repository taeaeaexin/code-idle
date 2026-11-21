/* =========================================================
 * 개발자 키우기 - 게임 데이터 (언어, 업그레이드, 의뢰, 팀, 용어 사전 등)
 * ========================================================= */
'use strict';

const I = '    ';

function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
// n번째 반복이면 뒤에 2, 3...을 붙임 (예: getUser, getUser2)
function suffix(n, len) { const r = Math.floor(n / len); return r > 0 ? String(r + 1) : ''; }

/* ---------- 모듈, 파일 ---------- */
const MODULES = ['User', 'Order', 'Payment', 'Schedule', 'Notice', 'Report', 'Board', 'Member'];
const KO = { User: '사용자', Order: '주문', Payment: '결제', Schedule: '근무표', Notice: '공지사항', Report: '리포트', Board: '게시판', Member: '회원' };
function koOf(M) { const m = M.match(/^(\D+)(\d*)$/); return (KO[m[1]] || m[1]) + m[2]; }

const FILE_TPL = [
  { lang: 'java', role: 'controller', name: M => M + 'Controller.java', desc: M => koOf(M) + ' 화면 요청을 받는 컨트롤러' },
  { lang: 'java', role: 'service',    name: M => M + 'Service.java',    desc: M => koOf(M) + ' 업무 로직을 처리하는 서비스' },
  { lang: 'xml',  role: 'mapper',     name: M => M + 'Mapper.xml',      desc: M => koOf(M) + ' SQL을 모아둔 MyBatis 매퍼' },
  { lang: 'sql',  role: 'ddl',        name: M => 'TB_' + M.toUpperCase() + '.sql', desc: M => koOf(M) + ' 테이블 생성 스크립트' },
  { lang: 'js',   role: 'view',       name: M => lower(M) + '.js',      desc: M => koOf(M) + ' 화면 동작 스크립트' },
  { lang: 'cs',   role: 'form',       name: M => M + 'Form.cs',         desc: M => koOf(M) + ' 관리자용 윈폼 화면' },
];

function fileInfo(idx) {
  const t = FILE_TPL[idx % FILE_TPL.length];
  const mi = Math.floor(idx / FILE_TPL.length);
  const M = MODULES[mi % MODULES.length] + (mi >= MODULES.length ? String(Math.floor(mi / MODULES.length) + 1) : '');
  const name = t.name(M);
  return {
    idx, M, m: lower(M), UP: M.toUpperCase(), lang: t.lang, role: t.role, name, cls: name.replace(/\.\w+$/, ''),
    desc: t.desc(M), target: Math.min(300, 40 + 12 * idx),
  };
}

const ACTIONS = [['get', '조회'], ['list', '목록 조회'], ['save', '저장'], ['update', '수정'], ['delete', '삭제'], ['count', '건수 조회'], ['search', '검색'], ['export', '엑셀 다운로드']];
const REVIEWS = ['네이밍 컨벤션 수정', '매직넘버 상수화', 'null 체크 추가', '중복 로직 제거', '주석 보완', '예외 처리 보강'];
const SWITCHES = ['청축', '갈축', '적축', '흑축', '저소음 적축'];

/* ---------- 언어별 코드 생성 규칙 ---------- */
const JAVA_VARS = [['int', 'pageSize', '20', '한 페이지에 보여줄 건수'], ['int', 'maxRetry', '3', '최대 재시도 횟수'], ['long', 'timeout', '30L', '타임아웃(초)'], ['String', 'useYn', '"Y"', '사용 여부'], ['int', 'cacheSize', '1024', '캐시 크기'], ['String', 'dateFormat', '"yyyyMMdd"', '날짜 형식'], ['int', 'batchSize', '100', '한 번에 처리할 건수'], ['boolean', 'debugMode', 'false', '디버그 모드 여부']];
const CS_VARS = [['int', 'pageSize', '20', '한 페이지 건수'], ['string', 'connStr', '"Data Source=ORCL"', 'DB 연결 문자열'], ['bool', 'isEditMode', 'false', '수정 모드 여부'], ['DataTable', 'dtList', 'new DataTable()', '조회 결과를 담는 표'], ['int', 'selectedRow', '-1', '선택된 행 번호'], ['string', 'loginUserId', '""', '로그인한 사용자']];
const JS_VARS = [['let', 'currentPage', '1', '현재 페이지'], ['const', 'PAGE_SIZE', '20', '한 페이지 건수'], ['let', 'selectedId', 'null', '선택된 항목 ID'], ['const', 'API_BASE', "'/api'", 'API 기본 주소'], ['let', 'isLoading', 'false', '로딩 중 여부'], ['const', 'DATE_FORMAT', "'YYYY-MM-DD'", '날짜 형식']];
const SQL_COLS = ['NAME', 'REG_DT', 'STATUS', 'DEPT_CD', 'USE_YN'];

function actOf(i) { const [a, ko] = ACTIONS[i % ACTIONS.length]; return { a, ko, sx: suffix(i, ACTIONS.length) }; }

const LANGS = {
  java: {
    name: 'Java', badge: 'J', color: '#f89820', ind: I,
    kw: ['public', 'private', 'protected', 'class', 'static', 'void', 'int', 'long', 'boolean', 'return', 'new', 'import', 'package', 'final', 'this', 'null', 'true', 'false', 'if', 'for', 'while', 'try', 'catch', 'throw', 'throws', 'extends', 'implements', 'interface'],
    cmRe: '\\/\\/.*$', blockRe: /^\s*(\/\*|\*)/, cmPick: /\/\/\s?(.*)$/,
    cm: t => '// ' + t,
    docHeader: ls => ['/**'].concat(ls.map(l => l ? ' * ' + l : ' *'), [' */']),
    section: t => ['/* ' + '='.repeat(40), ' * ' + t, ' * ' + '='.repeat(40) + ' */'],
    prologue: (f, st) => {
      const imps = [];
      if (st >= 1) imps.push('java.util.List', 'java.util.Map');
      if (st >= 2) imps.push('lombok.RequiredArgsConstructor');
      if (st >= 3 && f.role === 'service') imps.push('org.springframework.stereotype.Service');
      if (st >= 4 && f.role === 'controller') imps.push('org.springframework.web.bind.annotation.*');
      if (st >= 5) imps.push('org.springframework.cloud.client.discovery.EnableDiscoveryClient');
      if (st >= 6) imps.push('com.codeidle.ai.Agent');
      const out = ['package com.codeidle.' + f.role + ';', ''];
      if (imps.length) out.push(...imps.sort().map(x => 'import ' + x + ';'), '');
      if (f.role === 'controller' && st >= 4) out.push('@RestController', '@RequestMapping("/api/' + f.m + '")');
      if (f.role === 'service' && st >= 3) out.push('@Service');
      if (st >= 2) out.push('@RequiredArgsConstructor');
      if (st >= 5) out.push('@EnableDiscoveryClient');
      out.push('public class ' + f.cls + ' {', '');
      if (st >= 6) out.push(I + 'private final Agent dev = new Agent("frontier-latest");  // 이제 코드가 코드를 키운다', '');
      return out;
    },
    hello: ['// 첫 코드: 화면에 글자를 출력', 'System.out.println("hello, world");'],
    gen: {
      code: (lv, f, st) => {
        const k = lv - 1, i = Math.floor(k / 2);
        if (k % 2 === 0) { const v = JAVA_VARS[i % JAVA_VARS.length]; return ['private ' + v[0] + ' ' + v[1] + suffix(i, JAVA_VARS.length) + ' = ' + v[2] + ';  // ' + v[3]]; }
        const { a, ko, sx } = actOf(i);
        const name = a + f.M + sx;
        const out = ['', '/** ' + koOf(f.M) + ' ' + ko + ' */'];
        if (f.role === 'controller' && st >= 4) out.push('@GetMapping("/' + a + sx + '")');
        out.push('public ' + (st >= 2 ? f.M + 'Vo' : 'Object') + ' ' + name + '(Long id) {');
        out.push(f.role === 'controller' ? '    return ' + f.m + 'Service.' + name + '(id);  // 실제 처리는 서비스에 맡김' : '    return ' + f.m + 'Mapper.' + name + '(id);  // DB 작업은 매퍼가 담당');
        out.push('}');
        return out;
      },
      test: (lv, f) => { const { a, sx } = actOf(lv - 1); return ['', '@Test', 'void ' + a + f.M + sx + 'Test() {', '    assertNotNull(' + f.m + 'Service.' + a + f.M + sx + '(1L));  // 결과가 비어 있지 않은지 확인', '}']; },
      log: (lv, f) => { const { a, sx } = actOf(lv - 1); return ['log.info("[' + f.M + '] ' + a + sx + ' 실행");  // 실행 흐름을 로그로 남김']; },
      doc: (lv, f) => { const { ko } = actOf(lv - 1); return ['/**', ' * ' + koOf(f.M) + ' ' + ko + ' API', ' * @param id 대상 ID', ' * @return 처리 결과', ' */']; },
      review: lv => ['// [코드리뷰] ' + REVIEWS[(lv - 1) % REVIEWS.length] + ' 반영'],
      ci: lv => ['// [CI] 빌드 #' + lv + ' 통과, 자동 배포 완료'],
      srv: lv => ['server.scale(' + Math.pow(2, lv) + ');  // 서버를 ' + lv + '대로 늘림'],
      key: lv => ['// 데스크 셋업 Lv.' + lv],
    },
    common: {
      code: (n, f) => ['/** 공통 처리: 비슷하던 메서드 ' + n + '개를 하나로 통합 */', 'public <T> T execute(String action, Long id) {', '    return commonService.execute("' + f.m + '." + action, id);', '}'],
      test: () => ['@ParameterizedTest  // 비슷한 테스트를 하나로 묶어 여러 값으로 실행', '@ValueSource(longs = {1L, 2L, 3L})', 'void commonTest(long id) {', '    assertNotNull(commonService.execute("get", id));', '}'],
      doc: () => ['// 나머지 API 문서는 Swagger로 자동 생성'],
      srv: lv => ['private static final int SERVER_WORKERS = ' + Math.pow(2, lv) + ';  // 서버 대수를 설정값 하나로 관리'],
    },
    fillers: f => {
      const M = f.M, m = f.m, UP = f.UP;
      return [
        ['// ' + koOf(M) + ' 목록을 조회해서 사용 중인 것만 담기', 'List<' + M + 'Vo> list = ' + m + 'Mapper.select' + M + 'List(searchVo);', 'for (' + M + 'Vo vo : list) {', '    if ("Y".equals(vo.getUseYn())) {', '        resultList.add(vo);', '    }', '}'],
        ['try {', '    int result = ' + m + 'Mapper.insert' + M + '(vo);  // 등록된 건수가 돌아옴', '    log.info("insert result : " + result);', '} catch (Exception e) {', '    log.error("등록 실패", e);', '    throw new BizException("ERR_001");  // 공통 예외로 바꿔서 던짐', '}'],
        ['// 문자열을 여러 번 이어 붙일 때는 StringBuilder', 'StringBuilder sb = new StringBuilder();', 'sb.append("SELECT ID, NAME FROM TB_' + UP + '");', 'sb.append(" WHERE USE_YN = \'Y\'");', 'String query = sb.toString();'],
        ['// 파라미터를 Map에 담아 매퍼로 전달', 'Map<String, Object> paramMap = new HashMap<>();', 'paramMap.put("id", id);', 'paramMap.put("startDt", startDt);', 'List<Map<String, Object>> rows = commonMapper.selectList(paramMap);'],
        ['if (StringUtils.isEmpty(keyword)) {  // 필수값 검사', '    throw new IllegalArgumentException("keyword is required");', '}'],
        ['// 스트림으로 걸러서 이름만 모으기', 'List<String> names = list.stream()', '    .filter(v -> v.getAge() > 20)', '    .map(' + M + 'Vo::getName)', '    .collect(Collectors.toList());'],
        ['@Transactional  // 중간에 실패하면 전부 취소', 'public void save' + M + 'All(' + M + 'Vo vo) {', '    ' + m + 'Mapper.delete' + M + '(vo);', '    ' + m + 'Mapper.insert' + M + '(vo);', '}'],
        ['// 캐시에 있으면 DB 조회를 건너뜀', 'String cacheKey = "' + m + ':" + id;', M + 'Vo cached = cacheManager.get(cacheKey);', 'if (cached != null) {', '    return cached;', '}'],
        ['Optional<' + M + 'Vo> found = Optional.ofNullable(' + m + 'Mapper.select' + M + '(id));  // null을 안전하게 다룸', 'return found.orElseThrow(() -> new NotFoundException("데이터가 없습니다"));'],
      ];
    },
  },

  xml: {
    name: 'XML', badge: 'X', color: '#e44d26', ind: I,
    kw: ['SELECT', 'FROM', 'WHERE', 'AND', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'IN', 'LIKE', 'COUNT', 'SYSDATE'],
    cmRe: '&lt;!--.*?(?:--&gt;|$)', tagRe: '&lt;\\/?[\\w:!\\[]+|\\/?&gt;|\\]\\]&gt;', cmPick: /<!--\s?(.*?)\s?-->/,
    cm: t => '<!-- ' + t + ' -->',
    docHeader: ls => ls.map(l => '<!-- ' + l + ' -->'),
    section: t => ['<!-- ===== ' + t + ' ===== -->'],
    prologue: f => ['<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">', '<mapper namespace="com.codeidle.mapper.' + f.M + 'Mapper">', ''],
    gen: {
      code: (lv, f) => {
        const k = lv - 1, i = Math.floor(k / 2);
        const { a, ko, sx } = actOf(i);
        if (k % 2 === 0) return ['', '<!-- ' + koOf(f.M) + ' ' + ko + ' -->', '<select id="' + a + f.M + sx + '" resultType="' + f.M + 'Vo">', '    SELECT ID, NAME, REG_DT', '      FROM TB_' + f.UP, '     WHERE ID = #{id}', '</select>'];
        return ['', '<insert id="insert' + f.M + sx + (i ? i : '') + '">', '    INSERT INTO TB_' + f.UP + ' (ID, NAME, REG_DT)', '    VALUES (#{id}, #{name}, SYSDATE)', '</insert>'];
      },
      test: (lv, f) => { const { a, sx } = actOf(lv - 1); return ['<!-- [테스트] ' + a + f.M + sx + ' 결과 건수 검증 완료 -->']; },
      log: (lv, f) => { const { a, sx } = actOf(lv - 1); return ['<!-- [로그] ' + a + f.M + sx + ' 실행 시간 측정 -->']; },
      doc: (lv, f) => { const { ko } = actOf(lv - 1); return ['<!-- 설계: ' + koOf(f.M) + ' ' + ko + ', 파라미터 id -->']; },
      review: lv => ['<!-- [코드리뷰] ' + REVIEWS[(lv - 1) % REVIEWS.length] + ' 반영 -->'],
      ci: lv => ['<!-- [CI] 빌드 #' + lv + ' 통과 -->'],
      srv: lv => ['<!-- 서버 ' + lv + '대 운영, 커넥션 풀 ' + (10 * lv) + '개 -->'],
      key: lv => ['<!-- 데스크 셋업 Lv.' + lv + ' -->'],
    },
    common: {
      code: (n, f) => ['<!-- 비슷하던 쿼리 ' + n + '개를 동적 SQL 하나로 통합 -->', '<sql id="baseColumns">ID, NAME, REG_DT</sql>', '<select id="selectDynamic" resultType="map">', '    SELECT <include refid="baseColumns"/> FROM TB_' + f.UP, '    <where>', '        <if test="id != null">AND ID = #{id}</if>', '    </where>', '</select>'],
      test: () => ['<!-- 쿼리 테스트는 공통 테스트 클래스에서 일괄 수행 -->'],
      doc: () => ['<!-- 나머지 쿼리 설명은 테이블 정의서 참고 -->'],
      srv: lv => ['<!-- 서버 ' + lv + '대, 커넥션 풀 설정은 공통 설정 파일로 이동 -->'],
    },
    fillers: f => {
      const M = f.M, m = f.m, UP = f.UP;
      return [
        ['<!-- 조건이 있을 때만 WHERE 절을 붙이는 동적 쿼리 -->', '<select id="search' + M + '" resultType="' + M + 'Vo">', '    SELECT * FROM TB_' + UP, '    <where>', '        <if test="name != null">AND NAME LIKE \'%\' || #{name} || \'%\'</if>', '    </where>', '</select>'],
        ['<!-- 여러 건을 한 번에 지우는 foreach -->', '<delete id="delete' + M + 'List">', '    DELETE FROM TB_' + UP + ' WHERE ID IN', '    <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>', '</delete>'],
        ['<!-- 조회 결과 컬럼을 VO 필드에 연결 -->', '<resultMap id="' + m + 'Map" type="' + M + 'Vo">', '    <id property="id" column="ID"/>', '    <result property="name" column="NAME"/>', '</resultMap>'],
        ['<update id="update' + M + 'Name">', '    UPDATE TB_' + UP + ' SET NAME = #{name}, UPD_DT = SYSDATE', '     WHERE ID = #{id}', '</update>'],
        ['<!-- < 같은 특수문자가 섞인 SQL은 CDATA로 감싸기 -->', '<select id="countSmall' + M + '" resultType="int">', '    <![CDATA[ SELECT COUNT(*) FROM TB_' + UP + ' WHERE AMOUNT < 100 ]]>', '</select>'],
      ];
    },
  },

  sql: {
    name: 'SQL', badge: 'S', color: '#4ec9b0', ind: '',
    kw: ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'INDEX', 'ON', 'JOIN', 'GROUP', 'BY', 'ORDER', 'DESC', 'ASC', 'COMMIT', 'ROLLBACK', 'MERGE', 'USING', 'WHEN', 'MATCHED', 'THEN', 'NOT', 'NULL', 'PRIMARY', 'KEY', 'DEFAULT', 'COUNT', 'IS', 'COMMENT', 'AS', 'DUAL', 'SYSDATE', 'NUMBER', 'VARCHAR2', 'DATE'],
    cmRe: '--.*$', cmPick: /--\s?(.*)$/,
    cm: t => '-- ' + t,
    docHeader: ls => ls.map(l => '-- ' + l),
    section: t => ['-- ===== ' + t + ' ====='],
    prologue: () => ['-- 테이블과 인덱스를 만드는 스크립트', ''],
    gen: {
      code: (lv, f) => {
        const k = lv - 1, i = Math.floor(k / 2);
        if (k % 2 === 0) return ['', 'CREATE TABLE TB_' + f.UP + (i ? '_' + (i + 1) : '') + ' (', '    ID      NUMBER(10)     PRIMARY KEY,   -- 고유 번호', '    NAME    VARCHAR2(100)  NOT NULL,      -- 이름', '    REG_DT  DATE           DEFAULT SYSDATE  -- 등록일', ');'];
        const col = SQL_COLS[i % SQL_COLS.length];
        return ['CREATE INDEX IDX_' + f.UP + '_' + col + suffix(i, SQL_COLS.length) + ' ON TB_' + f.UP + ' (' + col + ');  -- 조회를 빠르게 하는 인덱스'];
      },
      test: (lv, f) => ['SELECT COUNT(*) FROM TB_' + f.UP + ';  -- [테스트] 데이터 건수 확인'],
      log: (lv, f) => ['-- [로그] TB_' + f.UP + ' 변경 이력은 감사 테이블에 기록'],
      doc: (lv, f) => ['COMMENT ON TABLE TB_' + f.UP + ' IS \'' + koOf(f.M) + ' 정보\';  -- 테이블 설명 달기'],
      review: lv => ['-- [코드리뷰] ' + REVIEWS[(lv - 1) % REVIEWS.length] + ' 반영'],
      ci: lv => ['-- [CI] 스키마 검증 #' + lv + ' 통과'],
      srv: lv => ['-- 서버 ' + lv + '대 운영, 커넥션 풀 ' + (10 * lv) + '개'],
      key: lv => ['-- 데스크 셋업 Lv.' + lv],
    },
    common: {
      code: n => ['-- 비슷하던 테이블 정의 ' + n + '개를 공통 코드 테이블로 통합', 'CREATE TABLE TB_COMMON_CODE (', '    CODE_ID  VARCHAR2(20) PRIMARY KEY,  -- 공통 코드', '    CODE_NM  VARCHAR2(100)              -- 코드 이름', ');'],
      test: () => ['-- 데이터 검증 쿼리는 배치 작업으로 이동'],
      doc: () => ['-- 나머지 설명은 테이블 정의서 참고'],
      srv: lv => ['-- 서버 ' + lv + '대 운영, 커넥션 풀은 공통 설정으로 관리'],
    },
    fillers: f => {
      const UP = f.UP;
      return [
        ['-- 부서별 인원 수 집계', 'SELECT DEPT_CD, COUNT(*) AS CNT', '  FROM TB_' + UP, ' GROUP BY DEPT_CD', ' ORDER BY CNT DESC;'],
        ['-- 두 테이블을 연결해서 조회 (JOIN)', 'SELECT A.ID, A.NAME, B.ORDER_DT', '  FROM TB_' + UP + ' A', '  JOIN TB_ORDER B ON A.ID = B.REF_ID', ' WHERE B.ORDER_DT >= SYSDATE - 7;'],
        ['INSERT INTO TB_' + UP + ' (ID, NAME) VALUES (SEQ_' + UP + '.NEXTVAL, \'홍길동\');', 'COMMIT;  -- 변경 내용을 확정'],
        ['-- 있으면 수정, 없으면 등록 (MERGE)', 'MERGE INTO TB_' + UP + ' T', 'USING (SELECT 1 AS ID FROM DUAL) S ON (T.ID = S.ID)', 'WHEN MATCHED THEN UPDATE SET T.NAME = \'수정\'', 'WHEN NOT MATCHED THEN INSERT (ID, NAME) VALUES (1, \'신규\');'],
        ['UPDATE TB_' + UP + ' SET USE_YN = \'N\' WHERE REG_DT < SYSDATE - 365;', 'ROLLBACK;  -- 실수했을 때 되돌리기'],
      ];
    },
  },

  js: {
    name: 'JavaScript', badge: 'JS', color: '#f0db4f', ind: '',
    kw: ['const', 'let', 'var', 'function', 'async', 'await', 'return', 'if', 'else', 'try', 'catch', 'throw', 'new', 'true', 'false', 'null'],
    cmRe: '\\/\\/.*$', blockRe: /^\s*(\/\*|\*)/, cmPick: /\/\/\s?(.*)$/,
    cm: t => '// ' + t,
    docHeader: ls => ['/**'].concat(ls.map(l => l ? ' * ' + l : ' *'), [' */']),
    section: t => ['/* ' + '='.repeat(40), ' * ' + t, ' * ' + '='.repeat(40) + ' */'],
    prologue: () => ["'use strict';  // 실수를 줄여주는 엄격 모드", ''],
    gen: {
      code: (lv, f) => {
        const k = lv - 1, i = Math.floor(k / 2);
        if (k % 2 === 0) { const v = JS_VARS[i % JS_VARS.length]; return [v[0] + ' ' + v[1] + suffix(i, JS_VARS.length) + ' = ' + v[2] + ';  // ' + v[3]]; }
        const { a, ko, sx } = actOf(i);
        return ['', '// ' + koOf(f.M) + ' ' + ko + ' API 호출', 'async function ' + a + f.M + sx + '() {', "  const res = await fetch('/api/" + f.m + '/' + a + "');", '  return res.json();', '}'];
      },
      test: (lv, f) => { const { a, sx } = actOf(lv - 1); return ['console.assert(typeof ' + a + f.M + sx + " === 'function');  // [테스트] 함수가 있는지 확인"]; },
      log: (lv, f) => { const { a, sx } = actOf(lv - 1); return ["console.log('[" + f.M + '] ' + a + sx + " 호출');  // 실행 흐름 확인"]; },
      doc: (lv, f) => { const { ko } = actOf(lv - 1); return ['/** @returns {Promise<Array>} ' + koOf(f.M) + ' ' + ko + ' 결과 */']; },
      review: lv => ['// [코드리뷰] ' + REVIEWS[(lv - 1) % REVIEWS.length] + ' 반영'],
      ci: lv => ['// [CI] 빌드 #' + lv + ' 통과, 자동 배포 완료'],
      srv: lv => ['const API_SERVERS = ' + lv + ';  // 서버 대수'],
      key: lv => ['// 데스크 셋업 Lv.' + lv],
    },
    common: {
      code: n => ['// 비슷하던 API 호출 ' + n + '개를 공통 함수로 통합', 'async function api(path, options = {}) {', "  const res = await fetch('/api/' + path, options);", "  if (!res.ok) throw new Error('API 오류: ' + res.status);", '  return res.json();', '}'],
      test: () => ['// 나머지 테스트는 공통 테스트 파일로 이동'],
      doc: () => ['// 나머지 함수 설명은 JSDoc으로 자동 생성'],
      srv: lv => ['const API_SERVERS = ' + lv + ';  // 서버 대수를 설정값 하나로 관리'],
    },
    fillers: f => {
      const M = f.M, m = f.m;
      return [
        ['// 검색 버튼을 누르면 목록 조회', "document.querySelector('#btnSearch').addEventListener('click', async () => {", "  const list = await fetch('/api/" + m + "').then(res => res.json());", '  renderTable(list);', '});'],
        ['// 사용 중인 것만 골라 이름순 정렬', 'const names = list', "  .filter(item => item.useYn === 'Y')", '  .map(item => item.name)', '  .sort();'],
        ['try {', '  await save' + M + '(form);', "  alert('저장되었습니다.');", '} catch (e) {', '  console.error(e);  // 오류 내용을 콘솔에 출력', '}'],
        ['// 입력값 검사', 'if (!form.name.trim()) {', "  alert('이름을 입력하세요.');", '  return;', '}'],
        ['const params = new URLSearchParams({ page: 1, size: 20 });  // 쿼리스트링 만들기', "const url = '/api/" + m + "?' + params.toString();"],
      ];
    },
  },

  cs: {
    name: 'C#', badge: 'C#', color: '#9b4f96', ind: I + I,
    kw: ['using', 'namespace', 'public', 'private', 'protected', 'partial', 'class', 'void', 'int', 'string', 'bool', 'var', 'if', 'return', 'foreach', 'in', 'new', 'try', 'catch', 'null', 'true', 'false', 'const', 'object'],
    cmRe: '\\/\\/.*$', cmPick: /\/\/\/?\s?(.*)$/,
    cm: t => '// ' + t,
    docHeader: ls => ls.map(l => l ? '// ' + l : '//'),
    section: t => ['// ===== ' + t + ' ====='],
    prologue: f => ['using System;', 'using System.Data;', 'using System.Windows.Forms;', '', 'namespace CodeIdle', '{', I + 'public partial class ' + f.cls + ' : Form', I + '{', ''],
    gen: {
      code: (lv, f) => {
        const k = lv - 1, i = Math.floor(k / 2);
        if (k % 2 === 0) { const v = CS_VARS[i % CS_VARS.length]; return ['private ' + v[0] + ' ' + v[1] + suffix(i, CS_VARS.length) + ' = ' + v[2] + ';  // ' + v[3]]; }
        const { a, ko, sx } = actOf(i);
        return ['', '// ' + koOf(f.M) + ' ' + ko + ' 버튼 클릭', 'private void btn' + cap(a) + f.M + sx + '_Click(object sender, EventArgs e)', '{', '    gridView.DataSource = dao.' + cap(a) + f.M + '();  // 결과를 그리드에 표시', '}'];
      },
      test: () => ['Debug.Assert(gridView.Rows.Count >= 0);  // [테스트] 그리드 확인'],
      log: (lv, f) => { const { a } = actOf(lv - 1); return ['Logger.Info("[' + f.M + '] ' + a + ' 실행");  // 로그 기록']; },
      doc: (lv, f) => { const { ko } = actOf(lv - 1); return ['/// <summary>' + koOf(f.M) + ' ' + ko + '</summary>']; },
      review: lv => ['// [코드리뷰] ' + REVIEWS[(lv - 1) % REVIEWS.length] + ' 반영'],
      ci: lv => ['// [CI] 빌드 #' + lv + ' 통과'],
      srv: lv => ['private const int ServerCount = ' + lv + ';  // 서버 대수'],
      key: lv => ['// 데스크 셋업 Lv.' + lv],
    },
    common: {
      code: n => ['// 비슷하던 버튼 이벤트 ' + n + '개를 공통 핸들러 하나로 통합', 'private void CommonButton_Click(object sender, EventArgs e)', '{', '    var action = ((Button)sender).Tag.ToString();  // 버튼마다 Tag로 동작 구분', '    gridView.DataSource = dao.Execute(action);', '}'],
      test: () => ['// 화면 테스트는 테스트 시나리오 문서로 관리'],
      doc: () => ['// 나머지 설명은 화면 설계서 참고'],
      srv: lv => ['private const int ServerCount = ' + lv + ';  // 서버 대수를 설정값 하나로 관리'],
    },
    fillers: f => {
      const M = f.M;
      return [
        ['// 그리드에서 선택한 행 가져오기', 'DataRow row = gridView.GetFocusedDataRow();', 'if (row == null) return;', 'string id = row["ID"].ToString();'],
        ['foreach (DataRow dr in dtList.Rows)  // 모든 행을 하나씩 반복', '{', '    total += Convert.ToInt32(dr["AMOUNT"]);', '}'],
        ['try', '{', '    dao.Save' + M + '(param);', '    MessageBox.Show("저장되었습니다.");', '}', 'catch (Exception ex)', '{', '    MessageBox.Show(ex.Message);  // 오류 메시지 표시', '}'],
        ['using (var cmd = new OracleCommand(sql, conn))  // 다 쓰면 자동으로 정리', '{', '    cmd.Parameters.Add("ID", id);', '    cmd.ExecuteNonQuery();', '}'],
        ['if (string.IsNullOrEmpty(txtName.Text))', '{', '    MessageBox.Show("이름을 입력하세요.");', '    return;', '}'],
      ];
    },
  },
};

/* ---------- 버그용 오타 ---------- */
const TYPOS = [
  ['return', 'retrun'], ['public', 'pubilc'], ['private', 'privte'], ['String', 'Strnig'], ['string', 'stirng'], ['static', 'statc'],
  ['void', 'viod'], ['new ', 'nwe '], ['class', 'calss'], ['import', 'improt'], ['null', 'nul'], ['List', 'Lsit'], ['Map', 'Mpa'],
  ['SELECT', 'SLECT'], ['FROM', 'FORM'], ['WHERE', 'WHRE'], ['INSERT', 'INSRET'], ['UPDATE', 'UPDTAE'], ['function', 'fucntion'],
  ['const', 'cosnt'], ['await', 'awiat'], ['resultType', 'resultTpye'], ['foreach', 'forech'], ['MessageBox', 'MesageBox'],
];
const STRAYS = ['/', ';', '.', ',', '\\', '`'];

/* ---------- 업그레이드 ---------- */
const UPGRADES = [
  { id: 'code',   name: '개발 실력',   base: 25,  growth: 1.32, unlock: 0,     step: 10,
    tiers: ['헬로월드 따라치기', '구글링', '스택오버플로우 복붙', '공식 문서 정독', '클린 코드', '디자인 패턴', '오픈소스 기여', '기술 블로그 운영', '아키텍처 설계', '컨퍼런스 발표', '10x 개발자', '살아있는 전설'] },
  { id: 'key',    name: '데스크 셋업', base: 40,  growth: 1.35, unlock: 0,     step: 10,
    tiers: ['회사 멤브레인 키보드', '기계식 키보드', '게이밍 마우스', '듀얼 모니터', '모니터 암', '모션 데스크', '게이밍 의자', '커스텀 무접점 키보드', '트리플 모니터', '방음 개인 부스', '꿈의 데스크 셋업', '우주정거장 데스크'] },
  { hidden: true, id: 'test',   name: '테스트 체계', base: 500, growth: 2.6,  unlock: 200,   step: 3, gloss: 'unit-test',
    tiers: ['눈으로 확인', '수동 테스트', '단위 테스트', '통합 테스트', '테스트 자동화', 'TDD'] },
  { hidden: true, id: 'review', name: '리뷰 문화',   base: 3e3, growth: 3,    unlock: 1e3,   step: 3, gloss: 'code-review',
    tiers: ['혼자 확인', '사수 리뷰', 'PR 리뷰', '페어 프로그래밍', 'AI 리뷰 봇'] },
  { hidden: true, id: 'doc',    name: '설계 문서',   base: 1e4, growth: 3.5,  unlock: 5e3,   step: 3, gloss: 'design-doc',
    tiers: ['메모장', '엑셀 정의서', '화면 설계서', 'ERD', '아키텍처 문서'] },
  { hidden: true, id: 'log',    name: '모니터링',    base: 3e4, growth: 4,    unlock: 1.5e4, step: 2, gloss: 'logging',
    tiers: ['System.out 디버깅', '로그 파일', '로그 검색 시스템', '모니터링 대시보드', '실시간 장애 알림'] },
  { hidden: true, id: 'ci',     name: '배포 방식',   base: 1e5, growth: 5,    unlock: 5e4,   step: 2, gloss: 'cicd',
    tiers: ['FTP 수동 업로드', '배포 스크립트', 'Jenkins', 'GitHub Actions', '무중단 자동 배포'] },
  { id: 'srv',    name: '인프라',      base: 5e4, growth: 25,   unlock: 2e4,   step: 1, gloss: 'scale-out',
    tiers: ['사무실 PC 서버', '전용 서버', 'IDC 랙', '클라우드', '오토스케일링', '멀티 리전'] },
];
function tierIdx(u, lv) { return Math.min(u.tiers.length - 1, Math.floor(lv / u.step)); }
function tierName(u, lv) { return u.tiers[tierIdx(u, lv)]; }

/* ---------- 아키텍처 단계 ---------- */
const STAGES = [
  { at: 0,    name: 'Hello World' },
  { at: 1e3,  name: '메서드 분리' },
  { at: 1e5,  name: '객체지향' },
  { at: 1e7,  name: '계층 분리' },
  { at: 1e9,  name: 'Spring Boot' },
  { at: 1e12, name: 'MSA' },
  { at: 1e15, name: 'AI 에이전트' },
];

/* ---------- 의뢰 ---------- */
const CLIENTS = ['한빛병원', '새솔대학병원', '누리물류', '가람제약', '바른보험', '도담대학교', '하늘은행', '미르성당', '온새미유통', '다온시청'];
const KINDS = [
  { id: 'maint', name: '유지보수',     rep: 0,  w: 3, time: 90,  rewardSec: 60,   repGain: 1,  spawn: 1,
    titles: ['로그인 오류 수정', '화면 문구 변경', '조회 조건 추가', '엑셀 다운로드 수정', '권한 메뉴 추가'],
    gen: () => ({ lines: ri(6, 12), bugs: 1 }) },
  { id: 'qa',    name: 'QA 결함 조치', rep: 2,  w: 2, time: 60,  rewardSec: 80,   repGain: 2,  spawn: 3,
    titles: ['통합테스트 결함 조치', 'UAT 결함 조치', '오픈 전 결함 조치'],
    gen: () => ({ bugs: 3 }) },
  { id: 'build', name: '신규 구축',    rep: 5,  w: 3, time: 300, rewardSec: 300,  repGain: 5,  spawn: 0,
    titles: ['근무표 화면 개발', '봉사자 관리 시스템 구축', '예약 시스템 개발', '재고관리 모듈 개발', '전자결재 연동'],
    gen: r => ({ lines: ri(25, 40), upgrades: ri(2, 4), earn: r * 120 }) },
  { id: 'boss',  name: '진상 고객사',  rep: 10, w: 1, time: 360, rewardSec: 900,  repGain: 8,  spawn: 0, boss: true,
    titles: ['"그냥 알아서 예쁘게" 홈페이지 개편', '"어제 말한 거랑 반대로" 화면 수정', '"다음 주 오픈인데 기능 추가요"'],
    gen: () => ({ lines: 50, bugs: 3, upgrades: 4 }) },
  { id: 'adv',   name: '고도화',       rep: 20, w: 2, time: 420, rewardSec: 600,  repGain: 10, spawn: 0,
    titles: ['인사 시스템 고도화', '조회 성능 개선', '통계 화면 고도화', '모바일 대응'],
    gen: r => ({ lines: ri(40, 60), upgrades: ri(4, 6), refactor: 1, grade: 2, earn: r * 240 }) },
  { id: 'next',  name: '차세대',       rep: 50, w: 1, time: 900, rewardSec: 1500, repGain: 25, spawn: 0, unique: true,
    titles: ['병원정보시스템 차세대 구축', '전사 ERP 차세대'],
    gen: r => ({ lines: 100, files: 1, refactor: 2, grade: 3, bugs: 5, earn: r * 500 }) },
];
const REQ_LABEL = { lines: '코드 작성', bugs: '버그 수정', refactor: '리팩토링', upgrades: '업그레이드', earn: '가치 벌기', files: '파일 완성', grade: '코드 상태' };
const REQ_UNIT = { lines: '줄', bugs: '개', refactor: '회', upgrades: '회', earn: '', files: '개', grade: '' };
const REQ_STAT = { lines: 'linesTyped', bugs: 'bugsFixed', refactor: 'refactors', upgrades: 'upgrades', earn: 'earned', files: 'filesDone' };
const GRADES = ['D', 'C', 'B', 'A', 'S'];
const GRADE_MULT = [1, 1.03, 1.08, 1.15, 1.25];

/* ---------- 팀 ---------- */
const AI_SUBS = [
  { id: 'gpt',     name: 'GPT 구독',     rep: 0,  cost: 500, fee: 0.03, kps: 2, desc: '초당 2회 자동 타이핑' },
  { id: 'claude',  name: 'Claude 구독',  rep: 5,  cost: 5e4, fee: 0.04, kps: 3, desc: '초당 3회 자동 타이핑, 코드 복잡도 증가 -10%' },
  { id: 'gemini',  name: 'Gemini 구독',  rep: 10, cost: 5e6, fee: 0.04, kps: 2, desc: '초당 2회 자동 타이핑, 20초마다 버그 1개 자동 수정' },
  { id: 'copilot', name: 'Copilot 구독', rep: 15, cost: 5e8, fee: 0.05, kps: 2, desc: '초당 2회 자동 타이핑, 업그레이드 코드 입력 속도 2배' },
];
const CREW = [
  { id: 'park', title: '과장', role: '백엔드 베테랑',   rep: 8,  cost: 1e6,  salary: 0.08, desc: '코드 복잡도 증가 -20%, 코드 상태가 C 이하로 떨어지면 알아서 리팩토링' },
  { id: 'jung', title: '과장', role: 'QA 리드',         rep: 12, cost: 1e7,  salary: 0.06, desc: '버그 발생 -30%, 장애 대응 시간 +10초' },
  { id: 'lee',  title: '차장', role: 'PM',              rep: 18, cost: 1e9,  salary: 0.07, desc: '의뢰 동시 진행 +1, 의뢰 자동 수락, 의뢰 보상 +25%' },
  { id: 'yoon', title: '과장', role: '인프라 엔지니어', rep: 22, cost: 1e11, salary: 0.06, desc: '트래픽 폭주에 항상 대응, 오프라인 수익 +20%' },
  { id: 'han',  title: '차장', role: '아키텍트',        rep: 30, cost: 1e13, salary: 0.09, desc: '코드 상태 등급 +1단계, 리팩토링 시간 -30%' },
  { id: 'choi', title: '부장', role: '영업 총괄',       rep: 40, cost: 1e16, salary: 0.1,  desc: '의뢰 평판 +50%, 새 의뢰가 두 배 빨리 들어옴' },
];

/* ---------- 랜덤 이름 ---------- */
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const GIVEN = ['준호', '하늘', '서연', '태민', '지우', '민석', '지훈', '수빈', '예린', '도윤', '하준', '서진', '유나', '현우', '지민', '채원', '승현', '다은', '건우', '소율', '재원', '나연', '시우', '연주'];
const CO_PRE = ['한빛', '새솔', '누리', '가람', '바른', '도담', '하늘', '미르', '온새미', '다온', '푸른', '새벽', '마루', '여울'];
const CO_SUF = ['소프트', '시스템즈', '정보기술', '테크', '아이티', '솔루션', '데이터'];

/* ---------- 커리어 ---------- */
const TITLES = ['신입', '주임', '대리', '과장', '차장', '부장'];
const EXEC = [
  { title: '이사', value: 1e10, rep: 30 },
  { title: '상무', value: 1e11, rep: 40 },
  { title: '전무', value: 1e12, rep: 50 },
  { title: 'CTO',  value: 1e13, rep: 60 },
];
const IPO_VALUE = 1e13;
const SKILLS = [
  { id: 'sql',     name: 'SQL 튜닝', max: 3, desc: '수입 x1.5' },
  { id: 'clean',   name: '클린코드', max: 3, desc: '코드 복잡도 증가 -25%' },
  { id: 'cicd',    name: '자동화 장인', max: 3, desc: '버그 발생 -25%, 리팩토링 시간 -30%' },
  { id: 'nego',    name: '협상력',   max: 3, desc: '의뢰 보상 +50%' },
  { id: 'lead',    name: '리더십',   max: 2, desc: '팀원 월급과 AI 구독료 -30%' },
  { id: 'typist',  name: '타자왕',   max: 3, desc: '타이핑 수익 x1.5' },
  { id: 'network', name: '인맥',     max: 2, desc: '이직 직후 평판 +10, 평판 효과 +50%' },
];

/* ---------- 상점 ---------- */
// 후원 링크 (비어 있으면 '준비 중'으로 표시)
const DONATE = { toss: '', kakao: '' };
const SHOW_DONATE = false;

// 점심 메뉴: 이벤트마다 3개를 무작위로 보여줌
const LUNCH = [
  { label: '국밥 (60초 수입 x1.2)', buffs: [['income', 1.2, 60, '국밥 x1.2']] },
  { label: '샐러드 (60초 코드 복잡도 증가 없음)', buffs: [['calm', 0, 60, '샐러드 복잡도 0']] },
  { label: '마라탕 (30초 타이핑 x2, 이후 20초 식곤증 x0.5)', buffs: [['typing', 2, 30, '마라탕 x2'], ['typing', 0.5, 20, '식곤증 x0.5', true, 30]] },
  { label: '라면 (30초 타이핑 x1.8)', buffs: [['typing', 1.8, 30, '라면 x1.8']] },
  { label: '돈까스 (40초 수입 x1.4, 이후 20초 식곤증 타이핑 x0.7)', buffs: [['income', 1.4, 40, '돈까스 x1.4'], ['typing', 0.7, 20, '식곤증 x0.7', true, 40]] },
  { label: '짜장면 (45초 타이핑 x1.5)', buffs: [['typing', 1.5, 45, '짜장면 x1.5']] },
  { label: '김밥 (90초 수입 x1.1)', buffs: [['income', 1.1, 90, '김밥 x1.1']] },
  { label: '떡볶이 (20초 타이핑 x2.5)', buffs: [['typing', 2.5, 20, '떡볶이 x2.5']] },
  { label: '치킨 (팀원들과 나눠 먹기: 평판 +1, 30초 수입 x1.2)', rep: 1, buffs: [['income', 1.2, 30, '치킨 x1.2']] },
  { label: '햄버거 (빨리 먹고 복귀: 60초 콤보 유지 시간 2배)', buffs: [['combo', 2, 60, '햄버거 콤보']] },
  { label: '초밥 (30초 수입 x1.5)', buffs: [['income', 1.5, 30, '초밥 x1.5']] },
  { label: '편의점 도시락 (45초 코드 복잡도 증가 없음)', buffs: [['calm', 0, 45, '도시락 복잡도 0']] },
];

const ITEMS = [
  { id: 'coffee', name: '아이스 아메리카노', sec: 20,  min: 50,  cd: 90,  desc: '30초 동안 타이핑 수익 x1.5' },
  { id: 'energy', name: '에너지 드링크',     sec: 40,  min: 200, cd: 150, desc: '60초 동안 수입 x1.3. 끝나면 15초 동안 피곤해서 수입 x0.7' },
  { id: 'glass',  name: '스마트글래스',      sec: 15,  min: 30,  stack: 5, desc: '가지고 있으면 버그가 생기는 순간 1개를 써서 바로 고쳐줌 (최대 5개까지 보관)' },
  { id: 'pizza',  name: '피자',              sec: 120, min: 500, cd: 180, desc: '팀원들과 나눠 먹고 평판 +1, 30초 동안 코드 복잡도가 늘지 않음' },
  { id: 'wrist',  name: '손목 받침대',       sec: 30,  min: 100, cd: 150, desc: '60초 동안 손목이 편해서 콤보가 잘 안 끊김 (키를 쉬어도 콤보가 이어지는 시간 2배)' },
];

/* ---------- 도트 아이콘 (16x16, '.'은 투명): 상점 아이템과 지속 효과 ---------- */
const ITEM_ART = {
  coffee: {
    pal: {"k": "#9e9e9e", "l": "#f2f2f2", "w": "#ffffff", "c": "#6b3d1e", "C": "#4a2812", "i": "#d6eef8", "s": "#2e9e5b"},
    rows: [
      "..........ss....",
      ".........ss.....",
      "..kkkkkkkssk....",
      ".kllllllllsllk..",
      ".kkkkkkkkskkkk..",
      "..kwiiiiisiiik..",
      "..kwicciscicck..",
      "..kwciiicsccik..",
      "..kwcccccsCcck..",
      "...kwccicscck...",
      "...kwcccccCck...",
      "...kwcCcccCck...",
      "....kwcCccck....",
      "....kwccCcck....",
      "....kkkkkkkk....",
      "................",
    ],
  },
  energy: {
    pal: {"k": "#6b6b9a", "b": "#1f4fd1", "B": "#173a99", "y": "#ffd400", "g": "#c9c9c9", "w": "#ffffff"},
    rows: [
      "................",
      ".....kkkkkk.....",
      "....kgggggwk....",
      "....kkkkkkkk....",
      "....kbbbbbwk....",
      "....kbbbyybk....",
      "....kbbyybbk....",
      "....kbyyyyyk....",
      "....kbbbyybk....",
      "....kbbyybBk....",
      "....kbbybbBk....",
      "....kbbbbbBk....",
      "....kBbbbbBk....",
      "....kkkkkkkk....",
      ".....kggggk.....",
      "................",
    ],
  },
  glass: {
    pal: {"k": "#6a6a6a", "f": "#3a3a3a", "l": "#4fc3f7", "L": "#b3e5fc", "g": "#7cfc00", "w": "#ffffff"},
    rows: [
      "................",
      "................",
      "................",
      "................",
      "kkkkkkkkkkkkkkkk",
      "kfffffkkkkfffffk",
      "kflLllkffkfllLlk",
      "kfLggllkkflgglLk",
      "kfllllfk.kfllllk",
      ".kflllfk.kflllk.",
      "..kfffk...kfffk.",
      "...kkk.....kkk..",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  pizza: {
    pal: {"k": "#7a4a26", "c": "#d9963b", "C": "#b8742a", "y": "#ffd24d", "Y": "#f5b82e", "r": "#c0392b", "R": "#8e2418", "g": "#4caf50"},
    rows: [
      "................",
      ".kkkkkkkkkkkkkk.",
      "kcCcCcCcCcCcCcck",
      "kCkkkkkkkkkkkkCk",
      ".kyyyrryyyyRrk..",
      ".kyyrRRyyYyyk...",
      "..kyrRryyyrk....",
      "..kyyyyyRrRk....",
      "...kyYyyrRk.....",
      "...kyygyyk......",
      "....kyyyk.......",
      "....kyRrk.......",
      ".....kyk........",
      ".....kk.........",
      "................",
      "................",
    ],
  },
  wrist: {
    pal: {"k": "#555b66", "b": "#2f3a4a", "B": "#243041", "g": "#6fb6ff", "G": "#3f8de0", "w": "#cfe8ff"},
    rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "...kkkkkkkkkk...",
      "..kgggwwgggggk..",
      ".kggGGGGGGGGggk.",
      ".kgGGGGGGGGGGgk.",
      ".kbbbbbbbbbbbbk.",
      ".kBBBBBBBBBBBBk.",
      "..kkkkkkkkkkkk..",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  gukbap: {
    pal: {"k": "#5a3a22", "b": "#2b2b2b", "B": "#444444", "s": "#f3e3c8", "S": "#e0c79d", "g": "#5aa64b", "m": "#b5674a", "w": "#ffffff"},
    rows: [
      "....w...w.......",
      ".....w...w..w...",
      "....w...w..w....",
      "................",
      "..ksssssssssk...",
      ".kssgsmSssmsSk..",
      ".kSsssssgssssk..",
      ".kbbbbbbbbbbbbk.",
      "..kbBbbbbbbBbk..",
      "...kbbbbbbbbk...",
      "....kbbbbbbk....",
      ".....kkkkkk.....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  salad: {
    pal: {"k": "#4a6b3a", "w": "#f5f5f5", "W": "#d8d8d8", "g": "#6bbf4e", "G": "#3f8f30", "r": "#e74c3c", "y": "#f1c40f"},
    rows: [
      "................",
      "................",
      ".....gGg.gG.....",
      "...gGgrgGgGgg...",
      "..gGgyGgGrgGgg..",
      "..kgGgGgGgyGgk..",
      ".kwwwwwwwwwwwwk.",
      ".kwWwwwwwwwwWwk.",
      "..kwwwwwwwwwwk..",
      "...kWwwwwwwWk...",
      "....kkkkkkkk....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  mala: {
    pal: {"k": "#5a1a12", "r": "#d62d20", "R": "#a81e14", "o": "#ff8a3d", "y": "#ffd54f", "b": "#2b2b2b", "B": "#444444", "w": "#ffffff"},
    rows: [
      "...w...w...w....",
      "....w...w...w...",
      "................",
      "..krrrrrrrrrk...",
      ".krroyrRrrorRk..",
      ".kRrrrryrRrrrk..",
      ".kbbbbbbbbbbbbk.",
      "..kbBbbbbbbBbk..",
      "...kbbbbbbbbk...",
      "....kbbbbbbk....",
      ".....kkkkkk.....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  zzz: {
    pal: {"z": "#9fb3ff", "Z": "#c9d6ff"},
    rows: [
      "................",
      "........ZZZZZ...",
      "...........Z....",
      "..........Z.....",
      ".........Z......",
      "........ZZZZZ...",
      "................",
      "...zzzz.........",
      "......z.........",
      ".....z..........",
      "....z...........",
      "...zzzz.........",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  moon: {
    pal: {"m": "#f5e27a", "M": "#d9c45a", "s": "#c9d6ff"},
    rows: [
      "................",
      ".....mmmm....s..",
      "...mmmm.........",
      "..mmmM......s...",
      "..mmM...........",
      ".mmmM...........",
      ".mmmM...........",
      ".mmmMM..........",
      ".mmmmMM.........",
      "..mmmmMMM...M...",
      "..mmmmmmMMMMm...",
      "...mmmmmmmmm....",
      ".....mmmmmm.....",
      "................",
      "................",
      "................",
    ],
  },
  rocket: {
    pal: {"w": "#eceff1", "W": "#b0bec5", "r": "#e74c3c", "b": "#4fc3f7", "o": "#ff9800", "y": "#ffd54f"},
    rows: [
      ".........rr.....",
      "........rwwr....",
      ".......wwwwW....",
      "......wwbbwW....",
      ".....wwbbbwW....",
      "....wwwwbwWW....",
      "...rwwwwwWW.....",
      "..rrwwwwWW......",
      "..rr.wwWW.......",
      ".....oWW........",
      "....oyo.........",
      "...oyo..........",
      "...yo...........",
      "................",
      "................",
      "................",
    ],
  },
  down: {
    pal: {"k": "#37474f", "s": "#607d8b", "S": "#455a64", "r": "#e53935", "g": "#7cfc00"},
    rows: [
      "................",
      "..kkkkkkkkkk....",
      "..ksssssssSk....",
      "..ksgsssssSk....",
      "..kkkkkkkkkk....",
      "..ksssssssSk....",
      "..ksrsssssSk....",
      "..kkkkkkkkkk.r.r",
      "..ksssssssSk..r.",
      "..ksrsssssSk.r.r",
      "..kkkkkkkkkk....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  snow: {
    pal: {"s": "#b3e5fc", "S": "#4fc3f7"},
    rows: [
      "................",
      ".......s........",
      ".....s.S.s......",
      "......sSs.......",
      "..s.s..S..s.s...",
      "...sS..S..Ss....",
      ".SSSSSSSSSSSSS..",
      "...sS..S..Ss....",
      "..s.s..S..s.s...",
      "......sSs.......",
      ".....s.S.s......",
      ".......s........",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  doc: {
    pal: {"k": "#78909c", "w": "#fafafa", "l": "#90a4ae", "b": "#4fc3f7"},
    rows: [
      "................",
      "...kkkkkkk......",
      "...kwwwwwkk.....",
      "...kwbbwwwkk....",
      "...kwwwwwwwk....",
      "...kwllllllk....",
      "...kwwwwwwwk....",
      "...kwllllwwk....",
      "...kwwwwwwwk....",
      "...kwlllllwk....",
      "...kwwwwwwwk....",
      "...kkkkkkkkk....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  wrench: {
    pal: {"s": "#b0bec5", "S": "#78909c"},
    rows: [
      "................",
      "..........ss....",
      ".........s..s...",
      "........sS......",
      "........sSS.....",
      ".......sSSs.....",
      "......sSS.......",
      ".....sSS........",
      "....sSS.........",
      "...sSS..........",
      "..sSS...........",
      "..SS............",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  broom: {
    pal: {"w": "#8d6e63", "y": "#ffd54f", "Y": "#e0a800", "s": "#fff59d"},
    rows: [
      "..s.........w...",
      "...........w....",
      ".s........w.....",
      ".........w....s.",
      "........w.......",
      ".......w........",
      "....yyyY........",
      "...yyyYYY.......",
      "..yyyyYYYY......",
      ".yyyYyYyYY......",
      ".yYyYyYyY.......",
      "..Y.Y.Y.........",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  ramen: {
    pal: {"k": "#5a2a12", "o": "#e8742a", "y": "#ffd54f", "e": "#ffffff", "Y": "#ffb300", "g": "#5aa64b", "r": "#c62828", "R": "#8e1b1b", "d": "#a0703c"},
    rows: [
      "...........d.d..",
      "..........d.d...",
      ".........d.d....",
      "..kyyyyyyyyyyk..",
      ".kyoyeeyoyyogyk.",
      ".koyeYeyoyoggok.",
      ".krrrrrrrrrrrrk.",
      "..krRrrrrrrRrk..",
      "...krrrrrrrrk...",
      "....krrrrrrk....",
      ".....kkkkkk.....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  donkatsu: {
    pal: {"k": "#8a8a8a", "w": "#f5f5f5", "W": "#d6d6d6", "c": "#c98a3a", "C": "#8a5a1f", "g": "#9be07a", "s": "#5a2a12"},
    rows: [
      "................",
      "................",
      "................",
      "....cCcCcCcC....",
      "...cccsccscccg..",
      "..cCcccCcccCcgg.",
      "..ccccscccsccgg.",
      ".kwwwwwwwwwwwwk.",
      "..kWwwwwwwwwWk..",
      "...kkkkkkkkkk...",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  jjajang: {
    pal: {"k": "#5a3a22", "w": "#f5f5f5", "u": "#3f6fd6", "j": "#3b2412", "J": "#5a3a1f", "y": "#e8c27a", "g": "#6bbf4e"},
    rows: [
      "................",
      "................",
      "....g.g.........",
      "..kjJjjgjJjjjk..",
      ".kjJjyjjJjjyjJk.",
      ".kyjjJjyjjJjjyk.",
      ".kwwwwwwwwwwwwk.",
      "..kwuwwuwwuwwk..",
      "...kwwwwwwwwk...",
      "....kwwwwwwk....",
      ".....kkkkkk.....",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  gimbap: {
    pal: {"k": "#1f3a1f", "w": "#fafafa", "y": "#ffd54f", "o": "#ff8a3d", "g": "#4caf50", "p": "#e57373", "P": "#9e9e9e"},
    rows: [
      "................",
      "................",
      "................",
      "................",
      "..kkkkk...kkkkk.",
      ".kwwwwwk.kwwwwwk",
      ".kwyogwk.kwgoywk",
      ".kwpgywk.kwypgwk",
      ".kwwwwwk.kwwwwwk",
      "..kkkkk...kkkkk.",
      "..PPPPPPPPPPPP..",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  tteok: {
    pal: {"k": "#5a1a12", "r": "#d62d20", "R": "#a81e14", "w": "#fff1e0", "W": "#e8d0b8", "b": "#3a3a3a", "e": "#ffffff", "Y": "#ffb300"},
    rows: [
      "................",
      "................",
      "................",
      "..krrrrrrrrrrk..",
      ".krwwWrrwwWrrrk.",
      ".krrrrwwWreYerk.",
      ".kRwwWrrrrrwwWk.",
      ".kbbbbbbbbbbbbk.",
      "..kbbbbbbbbbbk..",
      "...kkkkkkkkkk...",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  chicken: {
    pal: {"c": "#d9822b", "C": "#a8581a", "b": "#f5f0e0", "k": "#6b3a12"},
    rows: [
      "................",
      "................",
      "....kkkk........",
      "...kccccck......",
      "..kcCcccCck.....",
      "..kccCcccck.....",
      "..kcccCccck.....",
      "...kcccccck.....",
      "....kcccckb.....",
      "......kkkbbb....",
      "..........bbb...",
      "...........bb...",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  burger: {
    pal: {"t": "#e0a040", "T": "#c07a20", "s": "#fff3c0", "g": "#6bbf4e", "c": "#ffd54f", "m": "#6b3a1f", "k": "#5a3a12"},
    rows: [
      "................",
      "................",
      "................",
      ".....kkkkkk.....",
      "...kttsttsttk...",
      "..kttttttsttTk..",
      "..kTtstttttTTk..",
      "..gggggggggggg..",
      "..cccccccccccc..",
      "..kmmmmmmmmmmk..",
      "..kttttttttttk..",
      "...kTTTTTTTTk...",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  sushi: {
    pal: {"w": "#fafafa", "W": "#dcdcdc", "o": "#ff8a65", "O": "#ff7043", "f": "#ffd0c0", "r": "#e53935", "R": "#b71c1c", "n": "#1f3a1f", "P": "#5d4037"},
    rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".ofOofo...rRrrRr",
      ".ooofOo...rrRrrr",
      ".wwwwww...wwnnww",
      ".wWwwWw...wWnnWw",
      "PPPPPPPPPPPPPPP.",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  dosirak: {
    pal: {"k": "#37474f", "w": "#fafafa", "r": "#e53935", "y": "#ffd54f", "b": "#8d6e63", "g": "#6bbf4e"},
    rows: [
      "................",
      "................",
      "................",
      "..kkkkkkkkkkkk..",
      "..kwwwwwkrrggk..",
      "..kwwwwwkrrggk..",
      "..kwwrwwkkkkkk..",
      "..kwwwwwkbbyyk..",
      "..kwwwwwkbbyyk..",
      "..kkkkkkkkkkkk..",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  robot: {
    pal: {"k":"#37474f","s":"#b0bec5","S":"#78909c","e":"#4fc3f7","r":"#e53935"},
    rows: [
      ".......r........",
      ".......k........",
      "....kkkkkkkk....",
      "...ksssssssSk...",
      "...kseesseeSk...",
      "...kseesseeSk...",
      "...ksssssssSk...",
      "...kssSSSSsSk...",
      "....kkkkkkkk....",
      "..kkSSSSSSSSkk..",
      "..ksSssssssSsk..",
      "..ksSsseessSsk..",
      "..ksSssssssSsk..",
      "..kkSSSSSSSSkk..",
      "....kk....kk....",
      "................",
    ],
  },
};
// 지속 효과 라벨별 아이콘과 설명
const BUFF_INFO = {
  '커피 타이핑 x1.5': { icon: 'coffee', name: '아이스 아메리카노', desc: '타이핑 수익 x1.5' },
  '에너지 드링크 x1.3': { icon: 'energy', name: '에너지 드링크', desc: '수입 x1.3' },
  '피곤함 x0.7': { icon: 'zzz', name: '피곤함', desc: '에너지 드링크 후유증. 수입 x0.7' },
  '복잡도 증가 없음': { icon: 'pizza', name: '피자 파티', desc: '코드 복잡도가 늘지 않음' },
  '손목 받침대': { icon: 'wrist', name: '손목 받침대', desc: '콤보가 끊기지 않는 시간 2배' },
  '트래픽 폭주 x3': { icon: 'rocket', name: '트래픽 폭주', desc: '서버가 버텨서 수입 x3' },
  '서버 다운 x0.3': { icon: 'down', name: '서버 다운', desc: '수입 x0.3' },
  '코드 프리징': { icon: 'snow', name: '코드 프리징', desc: '업그레이드를 살 수 없음' },
  '문서화 x2': { icon: 'doc', name: '문서화 집중', desc: '타이핑 수익 x2' },
  '야근 x3': { icon: 'moon', name: '야근', desc: '타이핑 수익 x3' },
  '복구 작업 x0.5': { icon: 'wrench', name: '복구 작업', desc: '수입 x0.5' },
  '국밥 x1.2': { icon: 'gukbap', name: '든든한 국밥', desc: '수입 x1.2' },
  '샐러드 복잡도 0': { icon: 'salad', name: '가벼운 샐러드', desc: '코드 복잡도가 늘지 않음' },
  '마라탕 x2': { icon: 'mala', name: '얼얼한 마라탕', desc: '타이핑 수익 x2' },
  '식곤증 x0.5': { icon: 'zzz', name: '식곤증', desc: '타이핑 수익 x0.5' },
  '식곤증 x0.7': { icon: 'zzz', name: '식곤증', desc: '타이핑 수익 x0.7' },
  '라면 x1.8': { icon: 'ramen', name: '라면', desc: '타이핑 수익 x1.8' },
  '돈까스 x1.4': { icon: 'donkatsu', name: '돈까스', desc: '수입 x1.4' },
  '짜장면 x1.5': { icon: 'jjajang', name: '짜장면', desc: '타이핑 수익 x1.5' },
  '김밥 x1.1': { icon: 'gimbap', name: '김밥', desc: '수입 x1.1' },
  '떡볶이 x2.5': { icon: 'tteok', name: '떡볶이', desc: '타이핑 수익 x2.5' },
  '치킨 x1.2': { icon: 'chicken', name: '치킨', desc: '수입 x1.2' },
  '햄버거 콤보': { icon: 'burger', name: '햄버거', desc: '콤보가 끊기지 않는 시간 2배' },
  '초밥 x1.5': { icon: 'sushi', name: '초밥', desc: '수입 x1.5' },
  '도시락 복잡도 0': { icon: 'dosirak', name: '편의점 도시락', desc: '코드 복잡도가 늘지 않음' },
};

/* ---------- 책상 그림: 테마별 모니터 화면 색 ---------- */
const SCREEN = {
  dark:     { bg: '#0c1a29', night: '#081321', ln: '#33465a', cols: ['#4ec9b0', '#569cd6', '#ce9178', '#c586c0', '#9cdcfe', '#6a9955', '#dcdcaa'] },
  light:    { bg: '#f5f7fa', ln: '#b8c2cc', cols: ['#267f99', '#0000ff', '#a31515', '#af00db', '#001080', '#008000', '#795e26'] },
  monokai:  { bg: '#272822', ln: '#4f5048', cols: ['#a6e22e', '#f92672', '#e6db74', '#ae81ff', '#66d9ef', '#75715e', '#fd971f'] },
  terminal: { bg: '#020a02', ln: '#1f3a1f', cols: ['#33ff66', '#66ff99', '#2a9d4a', '#99ffcc', '#33ff66', '#2a7a3a', '#ccffcc'] },
};
/* ---------- 책상 위 작은 소품 (지속 효과 아이콘 이름과 같은 키) ---------- */
const bowl = (food, dish) => ({ pal: { f: food, b: dish }, rows: ['fffff', 'bbbbb', '.bbb.'] });
const plate = (food, food2) => ({ pal: { f: food, g: food2, p: '#f5f5f5' }, rows: ['.fgf.', 'ffgff', 'ppppp'] });
const DESK_MINI = {
  coffee:   { pal: { g: '#2e7d32', w: '#ffffff', c: '#cfd8dc', b: '#6b3d1e' }, rows: ['..g.', 'wwww', 'cbbc', 'cbbc', '.cc.'] },
  energy:   { pal: { s: '#b0bec5', b: '#1e3a8a', y: '#ffd54f' }, rows: ['sss', 'byb', 'byb', 'bbb', 'sss'] },
  wrist:    { pal: { g: '#6fb6ff', b: '#3f8de0' }, rows: ['gggggg', 'bbbbbb'] },
  pizza:    { pal: { c: '#c58a3a', o: '#f2b84b', r: '#d84315' }, rows: ['ccccc', 'oroor', '.oro.', '..o..'] },
  gukbap:   bowl('#f3e3c8', '#2b2b2b'),
  mala:     bowl('#d62d20', '#2b2b2b'),
  ramen:    bowl('#f0b030', '#c62828'),
  jjajang:  bowl('#3b2412', '#f5f5f5'),
  salad:    bowl('#6bbf4e', '#f5f5f5'),
  tteok:    bowl('#d62d20', '#3a3a3a'),
  donkatsu: plate('#c98a3a', '#9be07a'),
  sushi:    plate('#ff8a65', '#fafafa'),
  gimbap:   { pal: { k: '#1f3a1f', w: '#fafafa', y: '#ffd54f', p: '#9e9e9e' }, rows: ['kk.kk', 'yk.ky', 'ppppp'] },
  burger:   { pal: { t: '#e0a040', g: '#6bbf4e', m: '#6b3a1f' }, rows: ['.ttt.', 'ggggg', 'mmmmm', '.ttt.'] },
  chicken:  { pal: { c: '#d9822b', b: '#f5f0e0' }, rows: ['cc...', 'cccc.', '.ccbb'] },
  dosirak:  { pal: { k: '#37474f', w: '#fafafa', r: '#e53935', y: '#ffd54f' }, rows: ['kkkkkk', 'kwwkrk', 'kwwkyk', 'kkkkkk'] },
};


/* ---------- 기술 스택: 개발 실력 새 단계에 오를 때마다 3장 중 1장 선택 (이직하면 초기화) ---------- */
// fx: typing/income/all/bug/debt/refTime/combo/questTime/questRep/itemPrice/coffeeCd/codeChars는 곱하기,
//     deploy/incident/offline/autoType/bugBounty/bugPen은 더하기, autoFix는 가장 짧은 값, 나머지는 켜짐 여부
const AUG_TIERS = { s: { name: '실버', color: '#c0c7cf' }, g: { name: '골드', color: '#e6b94a' }, p: { name: '프리즘', color: '#c792ea' } };
const AUG_TAGS = {
  test:  { name: '테스트', icon: 'glass',  sets: [[2, '버그 발생 -30%', { bug: 0.7 }], [3, '버그를 고칠 때마다 5초치 수입', { bugBounty: 5 }]] },
  team:  { name: '협업',   icon: 'doc',    sets: [[2, '복잡도 증가 -20%', { debt: 0.8 }], [3, '복잡도 증가 -25%, 리팩토링 시간 -30%, 의뢰 평판 x1.3', { debt: 0.75, refTime: 0.7, questRep: 1.3 }]] },
  coffee:{ name: '커피',   icon: 'coffee', sets: [[2, '커피 재사용 대기 절반', { coffeeCd: 0.5 }], [3, '커피 무료', { coffeeFree: true }]] },
  night: { name: '야근',   icon: 'moon',   sets: [[2, '밤이나 야근 중 타이핑 x1.5', { nightTyping: 1.5 }], [3, '타이핑 수익 x1.5', { typing: 1.5 }]] },
  infra: { name: '인프라', icon: 'rocket', sets: [[2, '전체 수입 x1.2', { all: 1.2 }], [3, '전체 수입 x1.3, 오프라인 수익 +30%', { all: 1.3, offline: 0.3 }]] },
  ai:    { name: 'AI',     icon: 'robot',  sets: [[2, '초당 2회 자동 타이핑', { autoType: 2 }], [3, '초당 3회 더 자동 타이핑, 25초마다 버그 자동 수정', { autoType: 3, autoFix: 25 }]] },
};
const AUGS = [
  { id: 'unit',      t: 's', tags: ['test'],          name: '단위 테스트',      desc: '버그 발생 -25%', fx: { bug: 0.75 } },
  { id: 'review',    t: 's', tags: ['team'],          name: '코드 리뷰',        desc: '코드 복잡도 증가 -20%', fx: { debt: 0.8 } },
  { id: 'hotkey',    t: 's', tags: ['night'],         name: '단축키 마스터',    desc: '타이핑 수익 +25%', fx: { typing: 1.25 } },
  { id: 'subscribe', t: 's', tags: ['coffee'],        name: '커피 정기구독',    desc: '상점 아이템 가격 -40%', fx: { itemPrice: 0.6 } },
  { id: 'spec',      t: 's', tags: ['team'],          name: '요구사항 명세서',  desc: '의뢰 마감 시간 +30%', fx: { questTime: 1.3 } },
  { id: 'logfile',   t: 's', tags: ['test', 'infra'], name: '로그 파일',        desc: '버그가 생기면 그 줄로 자동 이동, 버그 1개당 수입 손실 감소', fx: { bugMove: true, bugPen: 0.08 } },
  { id: 'cache',     t: 's', tags: ['infra'],         name: '캐시 적용',        desc: '자동 수입 +25%', fx: { income: 1.25 } },
  { id: 'snippet',   t: 's', tags: ['ai'],            name: '코드 스니펫',      desc: '타이핑 수익 +15%, 업그레이드할 때 코드가 2배 빨리 입력', fx: { typing: 1.15, codeChars: 2 } },
  { id: 'stretch',   t: 's', tags: ['coffee'],        name: '스트레칭',         desc: '콤보가 끊기는 시간 +40%', fx: { combo: 1.4 } },
  { id: 'lint',      t: 's', tags: ['test', 'team'],  name: '린트 도구',        desc: '버그 발생 -15%, 복잡도 증가 -10%', fx: { bug: 0.85, debt: 0.9 } },
  { id: 'cicd',      t: 'g', tags: ['infra', 'test'], name: 'CI/CD 파이프라인', desc: '리팩토링 시간 -50%, 배포 성공률 +15%', fx: { refTime: 0.5, deploy: 0.15 } },
  { id: 'pair',      t: 'g', tags: ['team'],          name: '페어 프로그래밍',  desc: '콤보가 끊기는 시간 2배', fx: { combo: 2 } },
  { id: 'monitor',   t: 'g', tags: ['infra', 'test'], name: '모니터링 대시보드', desc: '20초마다 버그 1개 자동 수정, 장애 대응 시간 +15초', fx: { autoFix: 20, incident: 15 } },
  { id: 'coldbrew',  t: 'g', tags: ['coffee'],        name: '콜드브루 대용량',  desc: '커피 효과가 x1.5에서 x2로', fx: { coffeeBoost: 2 } },
  { id: 'overtime',  t: 'g', tags: ['night'],         name: '야근 수당',        desc: '밤(19시~6시)이나 야근 중 타이핑 수익 x2', fx: { nightTyping: 2 } },
  { id: 'copilot',   t: 'g', tags: ['ai'],            name: 'AI 자동완성',      desc: '초당 2회 자동 타이핑', fx: { autoType: 2 } },
  { id: 'cdn',       t: 'g', tags: ['infra'],         name: 'CDN',              desc: '전체 수입 +30%, 오프라인 수익 +20%', fx: { all: 1.3, offline: 0.2 } },
  { id: 'tdd',       t: 'g', tags: ['test'],          name: 'TDD',              desc: '버그 발생 -40%, 버그를 고칠 때마다 3초치 수입', fx: { bug: 0.6, bugBounty: 3 } },
  { id: 'standup',   t: 'g', tags: ['team'],          name: '데일리 스탠드업',  desc: '의뢰 평판 보상 x1.5, 마감 시간 +20%', fx: { questRep: 1.5, questTime: 1.2 } },
  { id: 'tenx',      t: 'p', tags: ['night'],         name: '10x 개발자',       desc: '타이핑 수익 x2', fx: { typing: 2 } },
  { id: 'autoscale', t: 'p', tags: ['infra'],         name: '오토스케일링',     desc: '전체 수입 x2', fx: { all: 2 } },
  { id: 'aipair',    t: 'p', tags: ['ai'],            name: 'AI 페어 코딩',     desc: '초당 5회 자동 타이핑, 자동 수입 +30%', fx: { autoType: 5, income: 1.3 } },
  { id: 'legacy',    t: 'p', tags: ['team'],          name: '레거시 수호자',    desc: '복잡도 때문에 수입이 줄지 않고, 레거시가 되면 오히려 수입 x1.5', fx: { legacyGuard: true } },
  { id: 'zerobug',   t: 'p', tags: ['test'],          name: '무결점 코드',      desc: '버그가 생기지 않음', fx: { bug: 0 } },
  { id: 'espresso',  t: 'p', tags: ['coffee'],        name: '에스프레소 머신',  desc: '커피 무료, 커피 재사용 대기 -70%', fx: { coffeeFree: true, coffeeCd: 0.3 } },
  { id: 'fullstack', t: 'p', tags: ['ai', 'infra', 'night'], name: '풀스택 개발자', desc: '전체 수입 +25%, 태그 3개를 한 번에 채움', fx: { all: 1.25 } },
];

const WORDS = ['select', 'commit', 'return', 'public', 'static', 'null', 'void', 'class', 'import', 'insert', 'update', 'delete', 'rollback', 'spring', 'mybatis', 'oracle', 'deploy', 'refactor', 'debug', 'merge', 'override', 'private', 'final', 'interface', 'foreach', 'async', 'await', 'const'];

const THEMES = [
  { id: 'dark',     name: '다크 모드',   need: 0, mode: true },
  { id: 'light',    name: '화이트 모드', need: 0, mode: true },
  { id: 'monokai',  name: '모노카이',   need: 6 },
  { id: 'terminal', name: '터미널',     need: 10 },
];
const SOUNDS = [['off', '끄기'], ['blue', '청축'], ['red', '적축'], ['silent', '저소음']];

/* ---------- 용어 사전 ---------- */
// m: 코드 한 줄에 이 글자가 들어 있으면 관련 용어로 보여줌
// game이 있는 항목은 게임 속 기능: 백과사전 맨 위에 '게임에서'와 '실무에서'를 함께 보여줌
const GLOSS_GAME_ORDER = ['augment', 'refactoring', 'grade', 'complexity', 'bug', 'legacy', 'combo', 'release', 'incident', 'deploy', 'freeze', 'unit-test', 'code-review', 'design-doc', 'logging', 'cicd', 'scale-out'];
const GLOSSARY = [
  { id: 'augment', cat: '게임', term: '기술 스택', m: [], desc: '', game: '개발 실력이 이 회사에서 처음으로 새 단계(10레벨마다)에 오르면 기술 스택 카드 3장 중 1장을 고릅니다. 등급은 실버, 골드, 프리즘이 있고 직급이 높을수록 좋은 등급이 잘 나옵니다. 마음에 안 드는 카드는 다시 뽑을 수 있습니다(회사마다 2회, 이직할 때마다 1회씩 늘어남). 같은 태그를 2장, 3장 모으면 시너지가 열립니다. 이직하면 1장만 포트폴리오로 가져가고, 새 회사에서 골드 이상 기술 스택을 바로 1번 뽑습니다.' },
  // 기초
  { id: 'comment', cat: '기초', term: '주석', m: ['//', '-- ', '<!--', '/*'], desc: '코드 실행에는 영향을 주지 않고 사람이 읽으라고 남기는 설명. 언어마다 // , -- , <!-- --> 처럼 표기법이 다르다.', ex: '// 사용자 목록 조회' },
  { id: 'println', cat: '기초', term: '출력 (System.out.println)', m: ['System.out', 'MessageBox.Show', 'alert('], desc: '화면이나 콘솔에 글자를 보여준다. 프로그래밍을 배울 때 가장 먼저 써보는 코드.', ex: 'System.out.println("hello, world");' },
  { id: 'class', cat: '기초', term: '클래스 (class)', m: ['class '], desc: '데이터(필드)와 동작(메서드)을 한데 묶은 설계도. 이 설계도로 실제 객체를 만들어 쓴다.', ex: 'public class UserService { ... }' },
  { id: 'field', cat: '기초', term: '변수와 필드', m: ['private int', 'private long', 'private String', 'private bool', 'private string', 'let ', 'const '], desc: '값을 담아두는 이름 붙은 상자. 클래스 안에 선언한 변수는 필드라고 부른다.', ex: 'private int pageSize = 20;' },
  { id: 'method', cat: '기초', term: '메서드와 함수', m: ['() {', 'function ', '_Click('], desc: '특정 작업을 하는 코드 묶음. 이름을 불러서 여러 번 재사용할 수 있다.', ex: 'public UserVo getUser(Long id) { ... }' },
  { id: 'access', cat: '기초', term: '접근 제어자 (public, private)', m: ['public ', 'private ', 'protected '], desc: 'public은 어디서나 사용 가능, private은 그 클래스 안에서만 사용 가능. 감출 건 감춰서 실수를 줄인다.', ex: 'private int count;' },
  { id: 'static', cat: '기초', term: 'static과 상수', m: ['static ', 'final ', 'const int'], desc: 'static은 객체를 만들지 않아도 클래스 이름으로 바로 쓰는 멤버, final(const)은 한 번 정하면 바뀌지 않는 값.', ex: 'private static final int MAX = 10;' },
  { id: 'null', cat: '기초', term: 'null', m: ['null'], desc: '"값이 없음"을 뜻하는 특별한 값. null인 변수를 그대로 쓰면 NullPointerException 같은 오류가 난다.', ex: 'if (user == null) return;' },
  { id: 'if', cat: '기초', term: '조건문 (if)', m: ['if ('], desc: '조건이 참일 때만 코드를 실행한다.', ex: 'if (age > 20) { ... }' },
  { id: 'loop', cat: '기초', term: '반복문 (for, foreach)', m: ['for (', 'foreach'], desc: '같은 코드를 여러 번 실행한다. 목록의 항목을 하나씩 꺼내 처리할 때 많이 쓴다.', ex: 'for (UserVo vo : list) { ... }' },
  { id: 'list', cat: '기초', term: 'List (목록)', m: ['List<', 'List '], desc: '순서가 있는 값들의 목록. 크기가 자동으로 늘어난다.', ex: 'List<String> names = new ArrayList<>();' },
  { id: 'map', cat: '기초', term: 'Map (키-값 묶음)', m: ['Map<', 'HashMap'], desc: '"키"로 "값"을 찾는 자료구조. 이름표를 붙여 물건을 보관하는 사물함과 비슷하다.', ex: 'paramMap.put("id", 1);' },
  { id: 'exception', cat: '기초', term: '예외 처리 (try-catch)', m: ['try', 'catch', 'throw '], desc: '오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 catch에서 대신 처리한다. 프로그램이 통째로 죽는 걸 막는다.', ex: 'try { save(); } catch (Exception e) { log.error(e); }' },
  { id: 'import', cat: '기초', term: 'import, package, using', m: ['import ', 'package ', 'using '], desc: 'package는 파일이 속한 폴더 같은 묶음, import(C#은 using)는 다른 곳에 있는 클래스를 가져와 쓰겠다는 선언.', ex: 'import java.util.List;' },
  { id: 'lambda', cat: '기초', term: '람다 (->, =>)', m: ['->', '=>'], desc: '이름 없이 짧게 쓰는 함수. 목록을 거르거나 변환할 때 자주 쓴다.', ex: 'list.filter(v -> v.getAge() > 20)' },
  // Java, Spring
  { id: 'stringbuilder', cat: 'Java', term: 'StringBuilder', m: ['StringBuilder', 'sb.append'], desc: '문자열을 여러 번 이어 붙일 때 쓰는 도구. + 로 계속 붙이는 것보다 빠르다.', ex: 'sb.append("SELECT ...");' },
  { id: 'stream', cat: 'Java', term: '스트림 (stream)', m: ['.stream()', '.filter(', '.map(', 'Collectors'], desc: '목록을 거르고(filter), 바꾸고(map), 모으는(collect) 작업을 한 줄씩 이어서 쓰는 방식.', ex: 'list.stream().filter(...).map(...)' },
  { id: 'optional', cat: 'Java', term: 'Optional', m: ['Optional'], desc: '값이 있을 수도 없을 수도 있음을 표현하는 상자. null 오류를 줄여준다.', ex: 'Optional.ofNullable(user).orElseThrow()' },
  { id: 'annotation', cat: 'Java', term: '어노테이션 (@)', m: ['@'], desc: '@로 시작하는 표시. 클래스나 메서드에 "이건 이런 역할이야"라고 꼬리표를 붙이면 프레임워크가 알아서 처리해준다.', ex: '@Service, @Test' },
  { id: 'transaction', cat: 'Java', term: '트랜잭션 (@Transactional)', m: ['@Transactional', 'COMMIT', 'ROLLBACK'], desc: '여러 DB 작업을 하나로 묶어서, 전부 성공하면 확정(커밋)하고 하나라도 실패하면 전부 취소(롤백)하는 것. 송금할 때 출금만 되고 입금이 안 되는 일을 막는다.', ex: '@Transactional public void transfer() { ... }' },
  { id: 'spring', cat: 'Java', term: 'Spring, Spring Boot', m: ['@RestController', '@RequestMapping', '@Service', 'springframework'], desc: '자바로 웹 서비스를 만들 때 가장 많이 쓰는 프레임워크. 반복되는 설정을 대신 해줘서 업무 코드에 집중할 수 있다.', ex: '@RestController' },
  { id: 'getmapping', cat: 'Java', term: '@GetMapping', m: ['@GetMapping'], desc: '특정 주소로 들어온 GET 요청을 이 메서드가 처리한다고 연결하는 어노테이션.', ex: '@GetMapping("/users")' },
  { id: 'controller', cat: 'Java', term: '컨트롤러 (Controller)', m: ['Controller'], desc: '화면이나 외부에서 들어온 요청을 가장 먼저 받는 계층. 직접 일을 하기보다 서비스에 넘긴다.', ex: 'UserController' },
  { id: 'service', cat: 'Java', term: '서비스 (Service)', m: ['Service'], desc: '실제 업무 규칙(비즈니스 로직)을 처리하는 계층.', ex: 'userService.save(user)' },
  { id: 'mapper', cat: 'Java', term: '매퍼, DAO', m: ['Mapper', 'Dao', 'dao.'], desc: 'DB에 SQL을 보내고 결과를 받아오는 담당. Controller, Service, Mapper(DAO)로 나누는 것을 계층 분리라고 한다.', ex: 'userMapper.selectUser(id)' },
  { id: 'vo', cat: 'Java', term: 'VO, DTO', m: ['Vo', 'Dto'], desc: '데이터를 담아서 계층 사이에 주고받는 그릇 역할의 클래스.', ex: 'public class UserVo { private String name; }' },
  { id: 'lombok', cat: 'Java', term: 'Lombok', m: ['@Getter', '@RequiredArgsConstructor', 'lombok'], desc: 'getter, 생성자 같은 반복 코드를 어노테이션 하나로 자동 생성해주는 라이브러리.', ex: '@Getter' },
  { id: 'unit-test', cat: 'Java', term: '단위 테스트', m: ['@Test', 'assert', 'Assert', '[테스트]'], desc: '코드가 의도대로 동작하는지 확인하는 코드. 미리 만들어두면 나중에 고쳐도 기존 기능이 깨졌는지 바로 알 수 있어 버그가 줄어든다.', game: '기술 스택 단위 테스트, 린트 도구, TDD, 무결점 코드와 [테스트] 시너지가 버그를 줄여줍니다.', ex: 'assertNotNull(userService.get(1L));' },
  { id: 'logging', cat: 'Java', term: '로깅 (log)', m: ['log.', 'Logger', 'console.log', '[로그]'], desc: '프로그램이 실행되며 무슨 일을 했는지 기록을 남기는 것. 장애가 났을 때 원인을 빨리 찾게 해준다.', game: '기술 스택 로그 파일은 버그가 생기면 그 줄로 자동 이동하고, 모니터링 대시보드는 20초마다 버그를 알아서 고치며 장애 대응 시간도 늘려줍니다.', ex: 'log.info("조회 시작");' },
  // DB, SQL
  { id: 'select', cat: 'SQL', term: 'SELECT', m: ['SELECT'], desc: 'DB에서 데이터를 조회하는 명령. FROM으로 테이블을, WHERE로 조건을 정한다.', ex: 'SELECT NAME FROM TB_USER WHERE ID = 1;' },
  { id: 'dml', cat: 'SQL', term: 'INSERT, UPDATE, DELETE', m: ['INSERT', 'UPDATE ', 'DELETE'], desc: '데이터를 추가(INSERT), 수정(UPDATE), 삭제(DELETE)하는 명령. 운영 DB에서는 WHERE 조건을 빠뜨리지 않게 특히 조심해야 한다.', ex: 'UPDATE TB_USER SET NAME = \'김\' WHERE ID = 1;' },
  { id: 'ddl', cat: 'SQL', term: 'CREATE TABLE (DDL)', m: ['CREATE TABLE'], desc: '테이블 같은 DB 구조를 만드는 명령. 컬럼 이름과 타입을 정한다.', ex: 'CREATE TABLE TB_USER (ID NUMBER);' },
  { id: 'pk', cat: 'SQL', term: '기본 키 (PRIMARY KEY)', m: ['PRIMARY KEY'], desc: '행 하나를 유일하게 구분하는 컬럼. 중복되거나 비어 있을 수 없다.', ex: 'ID NUMBER PRIMARY KEY' },
  { id: 'index', cat: 'SQL', term: '인덱스 (INDEX)', m: ['INDEX'], desc: '책의 색인처럼 원하는 데이터를 빨리 찾게 해주는 구조. 조회는 빨라지지만 저장은 조금 느려진다.', ex: 'CREATE INDEX IDX_USER_NAME ON TB_USER (NAME);' },
  { id: 'join', cat: 'SQL', term: '조인 (JOIN)', m: ['JOIN'], desc: '두 테이블을 공통 컬럼으로 연결해서 한 번에 조회하는 것.', ex: 'FROM TB_USER A JOIN TB_ORDER B ON A.ID = B.USER_ID' },
  { id: 'groupby', cat: 'SQL', term: 'GROUP BY', m: ['GROUP BY'], desc: '같은 값끼리 묶어서 개수, 합계 같은 집계를 구한다.', ex: 'SELECT DEPT, COUNT(*) FROM TB_USER GROUP BY DEPT' },
  { id: 'merge', cat: 'SQL', term: 'MERGE', m: ['MERGE'], desc: '데이터가 있으면 수정하고 없으면 새로 넣는 것을 한 번에 처리하는 명령.', ex: 'MERGE INTO TB_USER ...' },
  { id: 'sequence', cat: 'SQL', term: '시퀀스 (NEXTVAL)', m: ['NEXTVAL'], desc: '1, 2, 3처럼 겹치지 않는 번호를 차례대로 만들어주는 DB 객체.', ex: 'SEQ_USER.NEXTVAL' },
  { id: 'sysdate', cat: 'SQL', term: 'SYSDATE', m: ['SYSDATE'], desc: '오라클에서 현재 날짜와 시간을 돌려주는 값.', ex: 'WHERE REG_DT >= SYSDATE - 7' },
  { id: 'mybatis', cat: 'SQL', term: 'MyBatis', m: ['<select', '<insert', '<update', '<delete', '<mapper', 'mybatis'], desc: 'SQL을 XML 파일에 따로 적어두고 자바 코드에서 불러 쓰게 해주는 도구. 국내 SI 프로젝트에서 많이 쓴다.', ex: '<select id="selectUser">...</select>' },
  { id: 'binding', cat: 'SQL', term: '파라미터 바인딩 #{ }', m: ['#{'], desc: '자바에서 넘긴 값을 SQL에 안전하게 끼워 넣는 표기. 문자열을 직접 이어 붙이면 SQL 인젝션 공격에 취약해진다.', ex: 'WHERE ID = #{id}' },
  { id: 'dynamic-sql', cat: 'SQL', term: '동적 SQL', m: ['<if ', '<where>', '<foreach', '<include'], desc: '조건에 따라 SQL 일부를 붙였다 뺐다 하는 기능.', ex: '<if test="name != null">AND NAME = #{name}</if>' },
  { id: 'resultmap', cat: 'SQL', term: 'resultType, resultMap', m: ['resultType', 'resultMap'], desc: 'SQL 결과를 어떤 객체에 담을지 정하는 설정.', ex: 'resultType="UserVo"' },
  { id: 'cdata', cat: 'SQL', term: 'CDATA', m: ['CDATA'], desc: 'XML 안에서 < 같은 특수문자를 그대로 쓰고 싶을 때 감싸는 영역.', ex: '<![CDATA[ AMOUNT < 100 ]]>' },
  // JavaScript
  { id: 'const-let', cat: 'JavaScript', term: 'const, let', m: ['const ', 'let '], desc: 'const는 다시 바꿀 수 없는 변수, let은 바꿀 수 있는 변수를 만든다.', ex: 'const PAGE_SIZE = 20;' },
  { id: 'async', cat: 'JavaScript', term: 'async, await', m: ['async', 'await'], desc: '서버 응답처럼 시간이 걸리는 작업을 기다렸다가 다음 줄을 실행하게 해주는 문법.', ex: 'const res = await fetch(url);' },
  { id: 'fetch', cat: 'JavaScript', term: 'fetch, API 호출', m: ['fetch(', '/api'], desc: '브라우저에서 서버에 데이터를 요청하는 함수. 서버가 제공하는 데이터 주소를 API라고 한다.', ex: "fetch('/api/users')" },
  { id: 'dom', cat: 'JavaScript', term: 'DOM, querySelector', m: ['querySelector', 'document.', 'addEventListener'], desc: '화면의 요소를 찾아서(querySelector) 클릭 같은 이벤트에 반응하게(addEventListener) 만드는 것.', ex: "document.querySelector('#btn')" },
  { id: 'strict', cat: 'JavaScript', term: "'use strict'", m: ["'use strict'"], desc: '자바스크립트의 애매한 문법을 막아서 실수를 줄여주는 엄격 모드.', ex: "'use strict';" },
  // C#
  { id: 'winforms', cat: 'C#', term: 'WinForms', m: [': Form', 'MessageBox', 'gridView', '_Click'], desc: 'C#으로 윈도우 데스크톱 화면을 만드는 기술. 버튼, 그리드 같은 컨트롤을 배치하고 이벤트를 연결한다.', ex: 'private void btnSearch_Click(...)' },
  { id: 'datatable', cat: 'C#', term: 'DataTable, DataRow', m: ['DataTable', 'DataRow'], desc: '표 형태의 데이터를 메모리에 담는 객체. DataRow는 그 표의 한 줄.', ex: 'foreach (DataRow dr in dt.Rows)' },
  { id: 'using-block', cat: 'C#', term: 'using 블록', m: ['using ('], desc: 'DB 연결처럼 다 쓰면 꼭 닫아야 하는 자원을 블록이 끝날 때 자동으로 정리해준다.', ex: 'using (var conn = new OracleConnection())' },
  // 실무, 게임 개념
  { id: 'complexity', cat: '실무', term: '코드 복잡도', m: [], desc: '급하게 짠 코드가 쌓여 엉키는 정도. 실무에서는 "기술 부채"라고도 한다. 높을수록 수정이 어렵고 버그가 잘 생긴다.', game: '코드를 한 줄 칠 때마다 오릅니다. 업그레이드 레벨 합이 높을수록 덜 오르고, 리뷰 문화가 오르는 속도를 줄입니다. 높을수록 수입이 줄고(복잡도의 절반만큼 %), 버그가 자주 생기며, 코드 상태 등급이 떨어집니다. 100%가 되면 레거시가 됩니다.', ex: '' },
  { id: 'refactoring', cat: '실무', term: '리팩토링', m: [], desc: '동작은 그대로 두고 코드 구조만 깔끔하게 고치는 일. 중복을 합치고 구역을 정리한다.', game: '리팩토링 버튼을 누르면 몇 초 동안 타이핑이 멈추고 수입이 절반이 됩니다. 끝나면 코드 복잡도가 0, 버그가 모두 사라져 코드 상태가 S로 돌아옵니다. 코드 상태가 이미 S면 누를 수 없고, 아키텍처 단계에 도달하면 자동으로 리팩토링됩니다.', ex: '' },
  { id: 'legacy', cat: '실무', term: '레거시', m: [], desc: '오래되고 엉켜서 손대기 무서운 코드.', game: '코드 복잡도가 100%가 되면 레거시가 됩니다. 수입 x0.7, 리팩토링 시간 2배. 리팩토링하면 풀립니다.', ex: '' },
  { id: 'bug', cat: '실무', term: '버그', m: [], desc: '프로그램이 의도와 다르게 동작하게 만드는 코드 실수. 오타, 빠진 기호 같은 작은 실수가 큰 문제를 일으키기도 한다.', game: '코드 줄에 오타처럼 끼어듭니다. 버그 하나마다 수입이 줄고 코드 상태가 한 단계 내려갑니다. 빨간 줄을 누르면 고쳐지고, 리팩토링하면 모두 사라집니다. 테스트 체계는 발생을 줄이고, 모니터링은 찾기와 자동 수정을 돕고, 스마트글래스는 생기는 순간 고쳐줍니다.', ex: 'retrun result;  // return 오타' },
  { id: 'incident', cat: '실무', term: '장애', m: [], desc: '운영 중인 서비스가 멈추거나 오작동하는 상황. 빨리 원인을 찾아 복구하는 게 최우선이다.', game: '장애가 나면 제한 시간 안에 생긴 버그를 모두 고쳐야 합니다. 성공하면 평판이 오르고 실패하면 깎입니다. 모니터링 레벨이 오를수록 대응 시간이 늘어납니다.', ex: '' },
  { id: 'release', cat: '실무', term: '릴리즈, 버전', m: [], desc: '개발한 프로그램을 사용자에게 내보내는 것. v1.0, v2.0처럼 버전을 붙여 관리한다.', game: '서비스 가치가 100만원을 넘으면 릴리즈할 수 있습니다. 버전이 오르고 그동안의 최고 가치에 따라 영구 수입 배수를 받는 대신, 서비스 가치와 업그레이드가 초기화됩니다.', ex: '' },
  { id: 'deploy', cat: '실무', term: '배포', m: [], desc: '완성된 코드를 실제 서버에 올려 사용자가 쓸 수 있게 하는 작업. 금요일 오후 배포는 주말 장애로 이어지기 쉬워 개발자들이 꺼린다.', game: '금요일 배포 요청 같은 이벤트로 나옵니다. 성공률이 낮을수록 성공했을 때 보상이 큽니다. 배포 방식 업그레이드가 성공률을 올립니다.', ex: '' },
  { id: 'code-review', cat: '실무', term: '코드 리뷰', m: ['[코드리뷰]'], desc: '내가 짠 코드를 동료가 읽고 문제점이나 개선점을 짚어주는 과정. 코드가 엉키는 걸 막아준다.', game: '기술 스택 코드 리뷰, 린트 도구와 [협업] 시너지가 코드 복잡도가 오르는 속도를 줄여줍니다.', ex: '' },
  { id: 'design-doc', cat: '실무', term: '설계 문서', m: ['@param', '@return', '<summary>', '설계:'], desc: '무엇을 어떻게 만들지 미리 정리한 문서. 설계가 탄탄하면 개발이 빨라져 마감을 지키기 쉽다.', game: '기술 스택 요구사항 명세서와 데일리 스탠드업이 의뢰 마감 시간을 늘려줍니다.', ex: '' },
  { id: 'cicd', cat: '실무', term: 'CI/CD', m: ['[CI]'], desc: '코드를 올리면 빌드, 테스트, 배포까지 자동으로 해주는 체계. 사람 손을 덜 타서 실수가 줄고 빨라진다.', game: '기술 스택 CI/CD 파이프라인이 리팩토링 시간을 절반으로 줄이고 배포 성공률을 올려줍니다.', ex: '' },
  { id: 'scale-out', cat: '실무', term: '서버 증설 (스케일 아웃)', m: ['scale(', 'ServerCount', 'API_SERVERS', 'SERVER_WORKERS', '서버 '], desc: '서버 대수를 늘려 더 많은 사용자를 감당하는 것. 사용자가 몰려도 서비스가 버틴다.', game: '업그레이드 \'인프라\'. 비싸지만 레벨마다 전체 수입 x2. 트래픽 폭주 이벤트를 버티게 해주고 오프라인 수익도 늘려줍니다.', ex: '' },
  { id: 'msa', cat: '실무', term: 'MSA', m: ['DiscoveryClient', 'Gateway'], desc: '큰 서비스를 작은 서비스 여러 개로 쪼개 따로 배포하고 운영하는 구조.', ex: '' },
  { id: 'si-sm', cat: '실무', term: 'SI, SM', m: [], desc: 'SI는 고객사 시스템을 새로 구축하는 일, SM은 구축된 시스템을 유지보수하는 일.', ex: '' },
  { id: 'uat', cat: '실무', term: 'UAT', m: [], desc: '오픈 전에 실제 사용자가 직접 써보며 확인하는 인수 테스트.', ex: '' },
  { id: 'freeze', cat: '실무', term: '코드 프리징', m: [], desc: '오픈 직전 안정성을 위해 코드 변경을 막아두는 기간.', game: '코드 프리징 이벤트가 걸리면 60초 동안 업그레이드를 살 수 없습니다.', ex: '' },
  { id: 'combo', cat: '게임', term: '콤보', m: [], desc: '', game: '끊지 않고 연속으로 치면 쌓입니다. 콤보 300에서 타이핑 수익 최대 x2. 1.3초 동안 안 치면 끊기고, 아래 콤보 게이지로 남은 시간을 볼 수 있습니다. 손목 받침대와 햄버거는 끊기는 시간을 2배로 늘려줍니다.', ex: '' },
  { id: 'grade', cat: '게임', term: '코드 상태 (S~D)', m: [], desc: '', game: '지금 코드 복잡도로 실시간 매겨지는 등급입니다. 복잡도 10% 이하 S, 25% 이하 A, 45% 이하 B, 70% 이하 C, 그 이상 D. 버그가 있으면 한 단계 내려갑니다. 수입 배수는 D x1, C x1.03, B x1.08, A x1.15, S x1.25이고, 의뢰 평판 보상은 S면 2배, A면 1.5배입니다. 등급이 떨어지면 리팩토링으로 S로 되돌리세요.', ex: '' },
];
