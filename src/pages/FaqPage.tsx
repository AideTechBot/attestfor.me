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
        ATtestfor.me is a <strong>verified link page</strong> for your online
        accounts. You know those link-in-bio pages (like Linktree) that list all
        your accounts in one place? This is that, except every account listed
        has been <strong>cryptographically proven</strong> to belong to you.
        Visitors to your profile can be certain the links are genuine and not
        faked or impersonated.
      </>
    ),
  },
  {
    q: "Why is that better than a normal link page?",
    a: (
      <>
        On a normal link page, anyone could claim to own any account just by
        typing it in. Here, each account is only added after you{" "}
        <strong>prove you control it</strong> by posting a unique code to that
        account. Only the real owner can do that. The proof is stored publicly
        and permanently, so anyone can independently check it at any time.
      </>
    ),
  },
  {
    q: "How do I prove I own an account?",
    a: (
      <ol className="list-decimal list-inside space-y-1 text-sm text-muted">
        <li>ATtestfor.me gives you a short unique text snippet to post.</li>
        <li>
          You post that snippet to the account you want to verify, for example
          as a public GitHub Gist.
        </li>
        <li>You paste the link to that post back into ATtestfor.me.</li>
        <li>
          ATtestfor.me fetches the post and confirms the snippet is there and
          correct.
        </li>
        <li>
          If it matches, the account is added to your profile as verified. Done.
        </li>
      </ol>
    ),
  },
  {
    q: 'What does "cryptographically verified" actually mean?',
    a: (
      <>
        The proof is mathematically tied to your identity in a way that cannot
        be forged or quietly altered. The snippet you post contains your unique
        identifier and a random one-time code, so it can only ever refer to you
        and that one verification attempt. Once stored, the record is{" "}
        <strong>tamper-evident</strong>: changing it causes the fingerprint of
        the data to change, and that mismatch is immediately detectable.
      </>
    ),
  },
  {
    q: "What is AT Protocol and why does it matter here?",
    a: (
      <>
        AT Protocol is an open standard for decentralized social apps. Every
        user has a permanent, unique ID called a <strong>DID</strong>. Your
        data, including your verified account links, lives in your own{" "}
        <strong>personal data repository</strong> that you control. ATtestfor.me
        reads and writes to that repository. Your profile belongs to you and
        persists regardless of what happens to this site.
      </>
    ),
  },
  {
    q: "What are public keys, and do I need to care about them?",
    a: (
      <>
        <strong>Most users can skip this entirely.</strong> For more technical
        users: you can publish your <strong>PGP or SSH public key</strong> on
        your profile. This lets others encrypt messages to you, or confirm that
        files and code commits were signed by you, all tied back to your AT
        Protocol identity.
      </>
    ),
  },
  {
    q: "Is my data private?",
    a: (
      <>
        Your verified account links and public keys are{" "}
        <strong>publicly visible</strong>. That is the whole point: people can
        look you up and trust your profile. ATtestfor.me never sees your private
        keys or passwords. Login uses the standard AT Protocol OAuth flow and no
        credentials are shared with this site.
      </>
    ),
  },
  {
    q: "Do I need a Bluesky account to use this?",
    a: (
      <>
        You need <strong>any AT Protocol account</strong>. AT Protocol is an
        open ecosystem with many apps built on top of it, including{" "}
        <a
          href="https://bsky.app/"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bluesky
        </a>
        ,{" "}
        <a
          href="https://tangled.org/"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Tangled
        </a>
        ,{" "}
        <a
          href="https://blackskyweb.xyz/"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Blacksky
        </a>
        ,{" "}
        <a
          href="https://leaflet.pub/"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Leaflet
        </a>
        ,{" "}
        <a
          href="https://npmx.dev/"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          npmx
        </a>
        ,{" "}
        <a
          href="https://witchsky.app/"
          className="text-accent hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Witchsky
        </a>
        , and more. What you need is an AT Protocol account with a DID and a
        handle, from any provider. Anyone can view profiles without logging in;
        you only need to sign in to create or edit your own.
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
          Everything you need to know about ATtestfor.me
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
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
