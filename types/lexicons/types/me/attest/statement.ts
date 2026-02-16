import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("me.attest.statement"),
    /**
     * The statement text.
     * @maxLength 10000
     * @maxGraphemes 10000
     */
    content: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 10000),
      /*#__PURE__*/ v.stringGraphemes(0, 10000),
    ]),
    /**
     * ISO 8601 timestamp when this statement was created.
     */
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * Optional: ISO 8601 timestamp when this statement was retracted.
     */
    retractedAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
    /**
     * Current status of this statement.
     * @default "active"
     */
    status: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.literalEnum(["active", "retracted"]),
      "active",
    ),
    /**
     * Optional short subject/title for the statement.
     * @maxGraphemes 256
     */
    subject: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringGraphemes(0, 256),
      ]),
    ),
  }),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "me.attest.statement": mainSchema;
  }
}
