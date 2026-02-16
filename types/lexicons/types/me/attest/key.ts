import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("me.attest.key"),
    /**
     * Optional comment or description.
     * @maxGraphemes 512
     */
    comment: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringGraphemes(0, 512),
      ]),
    ),
    /**
     * ISO 8601 timestamp when this key was published.
     */
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * Optional expiration date (ISO 8601).
     */
    expiresAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
    /**
     * Key fingerprint. For PGP: 40-char hex (SHA-1 of public key). For SSH: SHA256 hash in standard format.
     * @maxGraphemes 256
     */
    fingerprint: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringGraphemes(0, 256),
      ]),
    ),
    /**
     * Type of public key.
     */
    keyType: /*#__PURE__*/ v.string<
      "pgp" | "ssh-ecdsa" | "ssh-ed25519" | (string & {})
    >(),
    /**
     * Human-readable label for this key (e.g., 'work laptop', 'signing key').
     * @maxGraphemes 128
     */
    label: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringGraphemes(0, 128),
      ]),
    ),
    /**
     * The full public key in standard text format (ASCII-armored PGP, OpenSSH format, etc.).
     * @maxLength 16384
     * @maxGraphemes 16384
     */
    publicKey: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 16384),
      /*#__PURE__*/ v.stringGraphemes(0, 16384),
    ]),
    /**
     * Current status of this key.
     * @default "active"
     */
    status: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.literalEnum(["active", "revoked"]),
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
    "me.attest.key": mainSchema;
  }
}
