import { SCXML2WoTCodeParser } from "./wot-scxml";
import { DOMParser } from "@xmldom/xmldom";

// Wrapper to expose protected methods for unit testing
class TestSCXML2WoTCodeParser extends SCXML2WoTCodeParser {
  public testFindStateLevel(node: Node): number {
    return this.findStateLevel(node);
  }

  public testEnumerateStatePossibilities(node: Node): any {
    return this.enumerateStatePossibilities(node);
  }

  public testGetStateSchema(node: Node, schema: Record<string, any>): void {
    this.getStateSchema(node, schema);
  }

  public testFindWritableDataProperties(node: Node): string[] | undefined {
    return this.findWritableDataProperties(node);
  }

  public testAddParallelWotWrapper(node: Node): Element {
    return this.addParallelWotWrapper(node);
  }

  public testAddWoTProperty(element: Element): void {
    this.addWoTProperty(element);
  }

  public testAddWoTAction(element: Element): void {
    this.addWoTAction(element);
  }

  public testAddWoTEvent(element: Element): void {
    this.addWoTEvent(element);
  }

  public getProtoTD(): any {
    return this.protoTD;
  }

  public setScxmlNode(node: Node): void {
    this.scxmlNode = node;
  }

  public testGenerateStateCheckCode(op: any): string {
    return this.generateStateCheckCode(op);
  }

  public testGenerateCodeSnippets(): void {
    this.generateCodeSnippets();
  }

  public getCodeSnippets(): any {
    return this.codeSnippets;
  }
}

describe("wot-scxml", () => {
  let parser: TestSCXML2WoTCodeParser;

  beforeEach(() => {
    parser = new TestSCXML2WoTCodeParser();
  });

  describe("findStateLevel", () => {
    it("should return 0 for a state with no children", () => {
      const scxml = `<state xmlns="http://www.w3.org/2005/07/scxml" id="s1"></state>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(parser.testFindStateLevel(doc.documentElement)).toBe(0);
    });

    it("should return 1 for a state with one level of children", () => {
      const scxml = `<state xmlns="http://www.w3.org/2005/07/scxml" id="s1"><state id="s11"></state><final id="s12"></final></state>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(parser.testFindStateLevel(doc.documentElement)).toBe(1);
    });

    it("should return correct max level for nested states", () => {
      const scxml = `
        <state xmlns="http://www.w3.org/2005/07/scxml" id="s1">
          <state id="s11">
            <state id="s111"></state>
          </state>
          <state id="s12"></state>
        </state>
      `;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(parser.testFindStateLevel(doc.documentElement)).toBe(2);
    });
  });

  describe("enumerateStatePossibilities", () => {
    it("should return node ID for state with no children", () => {
      const scxml = `<state xmlns="http://www.w3.org/2005/07/scxml" id="s1"></state>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(parser.testEnumerateStatePossibilities(doc.documentElement)).toBe(
        "s1",
      );
    });

    it("should return array of child IDs for state with multiple children", () => {
      const scxml = `<state xmlns="http://www.w3.org/2005/07/scxml" id="s1"><state id="s11"></state><state id="s12"></state></state>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(
        parser.testEnumerateStatePossibilities(doc.documentElement),
      ).toEqual(["s11", "s12"]);
    });

    it("should return object with child IDs as keys for parallel state", () => {
      const scxml = `<parallel xmlns="http://www.w3.org/2005/07/scxml" id="p1"><state id="s11"></state><state id="s12"></state></parallel>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(
        parser.testEnumerateStatePossibilities(doc.documentElement),
      ).toEqual({ s11: {}, s12: {} });
    });

    it("should handle complex nested states", () => {
      const scxml = `
        <state xmlns="http://www.w3.org/2005/07/scxml" id="s1">
          <state id="s11"></state>
          <state id="s12">
            <state id="s121"></state>
            <state id="s122"></state>
          </state>
          <parallel id="p1">
            <state id="p11"></state>
          </parallel>
        </state>
      `;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(
        parser.testEnumerateStatePossibilities(doc.documentElement),
      ).toEqual(["s11", { s12: ["s121", "s122"] }, { p1: { p11: {} } }]);
    });
  });

  describe("getStateSchema", () => {
    it("should return object type for state with no children", () => {
      const scxml = `<state xmlns="http://www.w3.org/2005/07/scxml" id="s1"></state>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      const schema: any = {};
      parser.testGetStateSchema(doc.documentElement, schema);
      expect(schema.type).toBe("object");
    });

    it("should return string enum for state with simple children", () => {
      const scxml = `<state xmlns="http://www.w3.org/2005/07/scxml" id="s1"><state id="s11"></state><state id="s12"></state></state>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      const schema: any = {};
      parser.testGetStateSchema(doc.documentElement, schema);
      expect(schema.type).toBe("string");
      expect(schema.enum).toEqual(["s11", "s12"]);
    });

    it("should return oneOf for state with complex children", () => {
      const scxml = `
        <state xmlns="http://www.w3.org/2005/07/scxml" id="s1">
          <state id="s11"></state>
          <state id="s12">
            <state id="s121"></state>
          </state>
        </state>
      `;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      const schema: any = {};
      parser.testGetStateSchema(doc.documentElement, schema);
      expect(schema.oneOf).toBeDefined();
      expect(schema.oneOf[0]).toEqual({ type: "string", enum: ["s11"] });
      expect(schema.oneOf[1].type).toBe("object");
      expect(schema.oneOf[1].required).toContain("s12");
      expect(schema.oneOf[1].properties.s12.type).toBe("string");
      expect(schema.oneOf[1].properties.s12.enum).toEqual(["s121"]);
    });

    it("should return object properties for parallel state", () => {
      const scxml = `<parallel xmlns="http://www.w3.org/2005/07/scxml" id="p1"><state id="s11"></state><state id="s12"></state></parallel>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      const schema: any = {};
      parser.testGetStateSchema(doc.documentElement, schema);
      expect(schema.type).toBe("object");
      expect(schema.required).toEqual(["s11", "s12"]);
      expect(schema.properties.s11.type).toBe("object");
      expect(schema.properties.s12.type).toBe("object");
    });
  });

  describe("findWritableDataProperties", () => {
    it("should return empty array if no properties found", () => {
      const scxml = `<scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:wot="http://example.com/wot"></scxml>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(
        parser.testFindWritableDataProperties(doc.documentElement),
      ).toEqual([]);
    });

    it("should find writable property with dataElement and schema", () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:wot="http://example.com/wot">
          <wot:property name="prop1" dataElement="data1">
            <content>{"type": "string"}</content>
          </wot:property>
        </scxml>
      `;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(
        parser.testFindWritableDataProperties(doc.documentElement),
      ).toEqual(["data1"]);
    });

    it("should ignore readOnly property", () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:wot="http://example.com/wot">
          <wot:property name="prop1" dataElement="data1">
            <content>{"type": "string", "readOnly": true}</content>
          </wot:property>
        </scxml>
      `;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      expect(
        parser.testFindWritableDataProperties(doc.documentElement),
      ).toEqual([]);
    });
  });

  describe("addParallelWotWrapper", () => {
    it("should return the existing top level parallel node if present", () => {
      const scxml = `<scxml xmlns="http://www.w3.org/2005/07/scxml"><parallel id="top"></parallel></scxml>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      const wrapper = parser.testAddParallelWotWrapper(doc.documentElement);
      expect(wrapper.nodeName).toBe("parallel");
      expect(wrapper.getAttribute("id")).toBe("top");
    });

    it("should wrap existing states in a _wotwrapper parallel node if not present", () => {
      const scxml = `<scxml xmlns="http://www.w3.org/2005/07/scxml"><state id="s1"></state><state id="s2"></state></scxml>`;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      const wrapper = parser.testAddParallelWotWrapper(doc.documentElement);
      expect(wrapper.nodeName).toBe("parallel");
      expect(wrapper.getAttribute("id")).toBe("_wotwrapper");

      const machineWrapper = wrapper.childNodes[0] as Element;
      expect(machineWrapper.nodeName).toBe("state");
      expect(machineWrapper.getAttribute("id")).toBe("_wotMachinewrapper");

      let stateCount = 0;
      for (let i = 0; i < machineWrapper.childNodes.length; i++) {
        if (machineWrapper.childNodes[i].nodeName === "state") stateCount++;
      }
      expect(stateCount).toBe(2);
    });
  });

  describe("addWoTProperty", () => {
    it("should extract property info into protoTD properties map", () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:wot="http://example.com/wot" xmlns:scxml="http://www.w3.org/2005/07/scxml">
          <scxml:datamodel>
            <scxml:data id="data1" expr="0"/>
          </scxml:datamodel>
          <wot:property name="myProp" dataElement="data1">
            <content>{"type": "number", "readOnly": true}</content>
          </wot:property>
        </scxml>
      `;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      const propNode = doc.getElementsByTagNameNS(
        "http://example.com/wot",
        "property",
      )[0];
      parser.setScxmlNode(doc.documentElement);
      parser.testAddWoTProperty(propNode);
      const td = parser.getProtoTD();
      expect(td.properties.myProp).toBeDefined();
      expect(td.properties.myProp.type).toBe("number");
      expect(td.properties.myProp.readOnly).toBe(true);
    });
  });

  describe("addWoTAction", () => {
    it("should extract action info into protoTD actions map", () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:wot="http://example.com/wot">
          <wot:action name="myAction">
            <content>{}</content>
            <wot:op type="invokeaction" event="doAction"/>
          </wot:action>
        </scxml>
      `;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      const actionNode = doc.getElementsByTagNameNS(
        "http://example.com/wot",
        "action",
      )[0];
      parser.testAddWoTAction(actionNode);
      const td = parser.getProtoTD();
      expect(td.actions.myAction).toBeDefined();
    });
  });

  describe("addWoTEvent", () => {
    it("should extract event info into protoTD events map", () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:wot="http://example.com/wot">
          <wot:event name="myEvent" emitEvent="fireMyEvent">
            <content>{}</content>
            <wot:op type="subscribeevent" event="onMyEvent"/>
          </wot:event>
        </scxml>
      `;
      const doc = new DOMParser().parseFromString(scxml, "application/xml");
      const eventNode = doc.getElementsByTagNameNS(
        "http://example.com/wot",
        "event",
      )[0];
      parser.testAddWoTEvent(eventNode);
      const td = parser.getProtoTD();
      expect(td.events.myEvent).toBeDefined();
    });
  });

  describe("generateStateCheckCode", () => {
    it("should generate JS code that validates the current state", () => {
      const opObj = {
        op: "readproperty",
        name: "testProp",
        availableIn: ["s11", "s12"],
      };
      const code = parser.testGenerateStateCheckCode(opObj);
      expect(code).toContain("const currentState = service.getSnapshot()");
      expect(code).toContain(
        '!["s11","s12"].some((s) => currentState.matches(s))',
      );
      expect(code).toContain(
        'throw new Error("readproperty testProp is not accessible in current state")',
      );
    });
  });

  describe("generateCodeSnippets", () => {
    it("should generate empty snippets if no operations exist", () => {
      const doc = new DOMParser().parseFromString(
        "<scxml/>",
        "application/xml",
      );
      parser.setScxmlNode(doc.documentElement);
      parser.testGenerateCodeSnippets();
      const snippets = parser.getCodeSnippets();
      expect(snippets.properties).toEqual({
        readproperty: "",
        writeproperty: "",
        observeproperty: "",
        unobserveproperty: "",
        emit: "",
        emitTransition: "",
      });
      expect(snippets.actions).toEqual({
        invokeaction: "",
      });
      expect(snippets.events.subscribeevent).toBe("");
      expect(snippets.events.unsubscribeevent).toBe("");
      expect(snippets.events.emit).toBe("");
    });
  });

  describe("generateXStateCode", () => {
    it("should successfully generate xstate config and a basic TD", async () => {
      const scxml = `
        <scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:wot="http://example.com/wot" xmlns:scxml="http://www.w3.org/2005/07/scxml" id="test-machine" initial="s1">
          <scxml:datamodel>
            <scxml:data id="data1" expr="0"/>
          </scxml:datamodel>
          <wot:affordances>
            <wot:property name="myProp" dataElement="data1">
              <content>{"type": "number", "readOnly": true}</content>
            </wot:property>
          </wot:affordances>
          <state id="s1">
            <transition event="go" target="s2"/>
          </state>
          <state id="s2">
          </state>
        </scxml>
      `;
      const res = await parser.generateXStateCode(scxml);
      expect(res).toContain("createMachine");
      expect(res).toContain("Servient");
      const td = parser.getProtoTD();
      expect(td).toBeDefined();
      expect(td.properties?.myProp).toBeDefined();
    });
  });
});
