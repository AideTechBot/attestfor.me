import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("me.attest.alpha.proof"),
    /**
     * The full challenge text the user posted on the external service.
     * @maxGraphemes 4096
     */
    challengeText: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringGraphemes(0, 4096),
      ]),
    ),
    /**
     * ISO 8601 timestamp when this proof was created.
     */
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * The user's handle/username on the external service or wallet address.
     * @maxGraphemes 512
     */
    handle: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringGraphemes(0, 512),
    ]),
    /**
     * Random nonce used in the proof challenge text (minimum 128 bits entropy).
     * @maxGraphemes 128
     */
    nonce: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringGraphemes(0, 128),
    ]),
    /**
     * URL where the proof text can be found (tweet URL, gist URL, etc.).
     * @maxGraphemes 2048
     */
    proofUrl: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.genericUriString(), [
      /*#__PURE__*/ v.stringGraphemes(0, 2048),
    ]),
    /**
     * Optional: ISO 8601 timestamp when this proof was retracted.
     */
    retractedAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
    /**
     * Canonical service identifier (e.g., 'twitter', 'github').
     */
    service: /*#__PURE__*/ v.string<"github" | "twitter" | (string & {})>(),
    /**
     * Current status of this proof.
     * @default "active"
     */
    status: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.literalEnum(["active", "retracted"]),
      "active",
    ),
  }),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "me.attest.alpha.proof": mainSchema;
  }
}
