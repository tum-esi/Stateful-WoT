import { delayToMs, SCXML2XStateCodeParser } from "./xstate-scxml";

describe("xstate-scxml", () => {
  describe("delayToMs", () => {
    it("should return number as is", () => {
      expect(delayToMs(50)).toBe(50);
    });

    it("should parse ms correctly", () => {
      expect(delayToMs("50ms")).toBe(50);
      expect(delayToMs("50 ms")).toBe(50);
    });

    it("should parse s correctly", () => {
      expect(delayToMs("5s")).toBe(5000);
      expect(delayToMs("5 s")).toBe(5000);
      expect(delayToMs("1.5s")).toBe(1500);
      expect(delayToMs(".5s")).toBe(500);
      expect(delayToMs("0.25s")).toBe(250);
    });

    it("should throw an error for unsupported format", () => {
      expect(() => delayToMs("5m")).toThrow();
    });
  });

  describe("SCXML2XStateCodeParser", () => {
    let parser: SCXML2XStateCodeParser;

    beforeEach(() => {
      parser = new SCXML2XStateCodeParser();
    });

    it("should generate machine config correctly", async () => {
      const scxml = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="init">
  <state id="init">
    <transition event="go" target="end"/>
  </state>
  <final id="end"/>
</scxml>`;

      const code = await parser.generateXStateCode(scxml);

      expect(code).toContain("createMachine");
      expect(code).toContain('initial: "init"');
      expect(code).toContain("init: {");
      expect(code).toContain("end: {");
      expect(code).toContain('type: "final"');
    });

    it("should parse parallel states correctly", async () => {
      const scxml = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="p1">
  <parallel id="p1">
    <state id="s1">
      <state id="s11"/>
    </state>
    <state id="s2">
      <state id="s21"/>
    </state>
  </parallel>
</scxml>`;
      const code = await parser.generateXStateCode(scxml);
      expect(code).toContain("p1: {");
      expect(code).toContain('type: "parallel"');
      expect(code).toContain("s1: {");
      expect(code).toContain("s2: {");
    });

    it("should parse history states correctly", async () => {
      const scxml = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="init">
  <state id="init">
    <history id="hist1" type="deep">
      <transition target="s2"/>
    </history>
    <state id="s2"/>
  </state>
</scxml>`;
      const code = await parser.generateXStateCode(scxml);
      expect(code).toContain("hist1: {");
      expect(code).toContain('type: "history"');
      expect(code).toContain('history: "deep"');
      expect(code).toContain('target: "s2"');
    });

    it("should parse datamodel correctly", async () => {
      const scxml = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="init">
  <datamodel>
    <data id="count" expr="0"/>
    <data id="user" expr='{"name":"John"}'/>
  </datamodel>
  <state id="init" />
</scxml>`;
      const code = await parser.generateXStateCode(scxml);
      expect(code).toContain("context: {");
      expect(code).toContain("count: 0");
      expect(code).toContain("user: {");
      expect(code).toContain('name: "John"');
    });

    it("should parse executable actions (assign, log, raise) correctly", async () => {
      const scxml = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="init">
  <datamodel>
    <data id="count" expr="0"/>
  </datamodel>
  <state id="init">
    <onentry>
      <assign location="count" expr="count + 1"/>
      <log label="info" expr="'Entered init'"/>
      <raise event="ready"/>
    </onentry>
  </state>
</scxml>`;
      const code = await parser.generateXStateCode(scxml);
      expect(code).toContain("assign({");
      expect(code).toContain("count: (context: any, event: any)");
      expect(code).toContain('return context["count"] + 1');
      expect(code).toContain("log(");
      expect(code).toContain('"info"');
      expect(code).toContain('type: "xstate.raise"');
      expect(code).toContain('event: "ready"');
    });

    it("should parse send and conditional if correctly", async () => {
      const scxml = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="init">
  <datamodel>
    <data id="status" expr='"testing"'/>
  </datamodel>
  <state id="init">
    <onentry>
      <if cond="status == 'testing'">
        <send event="test.passed" target="parent" delay="1s"/>
      <elseif cond="status == 'failing'"/>
        <send event="test.failed" target="parent"/>
      <else/>
        <send event="test.unknown" target="parent"/>
      </if>
    </onentry>
  </state>
</scxml>`;
      const code = await parser.generateXStateCode(scxml);
      expect(code).toContain('type: "xstate.choose"');
      expect(code).toContain('context["status"] == "testing"');
      expect(code).toContain('context["status"] == "failing"');
      expect(code).toContain('sendParent("test.passed"');
      expect(code).toContain("delay: 1000"); // Parsed from 1s
    });
  });
});
