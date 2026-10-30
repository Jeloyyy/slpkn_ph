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
        An educational project inspired by the game named Game of the Generals,
        created by Sofronio “Ronnie” Pasola.
        <strong>- JNK777</strong>
      </span>
      <span>Made for the love of the game.</span>
    </footer>
  );
}
