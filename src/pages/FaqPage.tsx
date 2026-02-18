import { Link } from "react-router";

interface FaqItem {
  q: string;
  a: React.ReactNode;
}

const FAQS: FaqItem[] = [
  {
    q: "What is ATtestfor.me?",
    a: (
      <>
        ATtestfor.me is a tool that lets you{" "}
        <strong>prove you own your online accounts</strong> (GitHub, Twitter,
        etc.) and <strong>share your cryptographic public keys</strong> — all
        tied to your AT Protocol identity. Think of it like a public,
        tamper-proof business card that says "these accounts really are mine."
      </>
    ),
  },
  {
    q: "What is AT Protocol?",
    a: (
      <>
        AT Protocol (used by Bluesky) is a decentralized social protocol where
        every user has a <strong>DID</strong> (Decentralized Identifier) — a
        permanent, globally unique ID you control. Your data lives in your own{" "}
        <strong>personal data repository</strong>, not on someone else's server.
        ATtestfor.me stores your proofs and keys directly inside that
        repository.
      </>
    ),
  },
  {
    q: "What is a proof?",
    a: (
      <>
        A proof is a small record that links your AT Protocol identity to an
        external account. To create one you post a special challenge string
        (containing your DID and a random nonce) to that external account — for
        example as a GitHub Gist. ATtestfor.me then fetches that post and
        confirms the text matches exactly. If it does, the link is verified.
      </>
    ),
  },
  {
    q: "How does the verification actually work?",
    a: (
      <ol className="list-decimal list-inside space-y-1 text-sm text-muted">
        <li>
          ATtestfor.me generates a unique challenge string containing your DID
          and a random nonce.
        </li>
        <li>
          You post that string to the external service (e.g. a public GitHub
          Gist).
        </li>
        <li>You paste the URL of that post back into ATtestfor.me.</li>
        <li>
          ATtestfor.me fetches the URL and checks that the content matches the
          challenge exactly.
        </li>
        <li>
          If it matches, a signed proof record is written to your AT Protocol
          repo.
        </li>
        <li>
          Anyone can re-run the same check at any time — the proof is publicly
          auditable.
        </li>
      </ol>
    ),
  },
  {
    q: "Why does the challenge have a nonce?",
    a: (
      <>
        The nonce (a random one-time number) prevents replay attacks. Without
        it, someone could copy an old challenge you posted elsewhere and claim
        it proves a different account. The nonce makes each challenge unique and
        single-use.
      </>
    ),
  },
  {
    q: "What are public keys used for?",
    a: (
      <>
        You can upload a <strong>PGP</strong> or <strong>SSH public key</strong>{" "}
        to your profile. This lets others encrypt messages to you, verify files
        or commits you signed, or confirm your identity in other tools — all
        anchored to your AT Protocol DID so people know the key genuinely
        belongs to you.
      </>
    ),
  },
  {
    q: "Can I trust that a proof hasn't been tampered with?",
    a: (
      <>
        Yes. AT Protocol repositories are <strong>content-addressed</strong>:
        every record has a CID (Content Identifier) which is a hash of its
        contents. If anyone edits the record, the CID changes and the mismatch
        is detectable. The proof also points to the external URL, so you can
        independently re-check that the original post still exists and still
        contains the correct challenge.
      </>
    ),
  },
  {
    q: "Does ATtestfor.me store my private keys?",
    a: (
      <>
        <strong>Never.</strong> Only your <em>public</em> key is uploaded. Your
        private key stays on your device. ATtestfor.me cannot sign or decrypt
        anything on your behalf.
      </>
    ),
  },
  {
    q: "Who can see my proofs and keys?",
    a: (
      <>
        Everyone. AT Protocol repositories are public by design. Anyone can look
        up your handle and see the proofs and keys you've published — that's the
        point. If you want to remove a record, you can delete or revoke it from
        the Edit Profile page and it will be removed from your repo.
      </>
    ),
  },
  {
    q: "Do I need a Bluesky account?",
    a: (
      <>
        You need an <strong>AT Protocol</strong> account, which today means a
        Bluesky account (or any other AT Protocol PDS). Sign in with your
        Bluesky handle and ATtestfor.me will take care of the rest via the
        standard AT Protocol OAuth flow — no passwords are shared with this
        site.
      </>
    ),
  },
];

export function FaqPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center shrink-0">
        <h1 className="text-2xl font-bold text-accent m-0 mb-1">FAQ</h1>
        <p className="text-sm text-muted m-0">
          How ATtestfor.me works and why it's useful
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {FAQS.map(({ q, a }) => (
          <div key={q} className="border border-surface-border p-4">
            <h2 className="text-sm font-semibold text-accent m-0 mb-2">{q}</h2>
            <div className="text-sm text-muted leading-relaxed">{a}</div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-muted pt-2 pb-1">
        <Link to="/" className="hover:text-accent transition-colors">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
