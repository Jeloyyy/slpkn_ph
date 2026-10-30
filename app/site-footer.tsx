import Image from "next/image";
import Link from "next/link";

type SiteFooterProps = {
  className?: string;
};

export default function SiteFooter({ className = "" }: SiteFooterProps) {
  return (
    <footer className={`site-footer ${className}`.trim()}>
      <Link className="brand" href="/" aria-label="SLPKN PH home">
        <Image
          className="brand-mark"
          src="/pieces/LOGO.jpg"
          alt=""
          width={36}
          height={36}
        />
        <span>SLPKN <b>PH</b></span>
      </Link>
      <span>
        SLPKN PH is an independent, non-profit educational project inspired by
        <em> Game of the Generals</em>, created by Sofronio H. Pasola Jr. It is
        not affiliated with or endorsed by the creator or rights holders, and
        does not claim ownership of the original game.
        <strong>- JNK777</strong>
      </span>
      <span>Made for the love of the game.</span>
    </footer>
  );
}
