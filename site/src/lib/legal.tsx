import Link from "next/link";
import type { ReactNode } from "react";
import type { LegalSection } from "@/components/LegalDocument";
import type { Locale } from "@/i18n/locales";

// Textes des pages /cgu et /confidentialite (version provisoire du 14/10/2026, demandée pour
// l'application Discord). Ils décrivent ce que fait réellement le code de la branche production :
// à mettre à jour à chaque fonction qui touche aux données (amis et présence, suppression de compte
// en libre-service, formulaire de contact...). La version de travail complète, avec les points à
// faire relire par un avocat, est Legal/DOCUMENTS_LEGAUX_OMNISCIENT.md.
export const LEGAL_EDITOR = "Rushifa";
export const LEGAL_EMAIL = "omniscient.launchermc@gmail.com";
const UPDATED = { fr: "Dernière mise à jour : 14 octobre 2026", en: "Last updated: October 14, 2026" };

type LegalPage = { title: string; updated: string; intro: ReactNode; sections: LegalSection[] };

const Mail = () => (
  <a href={`mailto:${LEGAL_EMAIL}`} className="text-foreground underline underline-offset-2">
    {LEGAL_EMAIL}
  </a>
);

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const B = ({ children }: { children: ReactNode }) => <strong className="text-foreground font-medium">{children}</strong>;

const DeletionFr = () => (
  <p>
    <B>Supprimer votre compte vous-même</B> : connectez-vous sur le site, puis Tableau de bord, Paramètres, « Supprimer
    mon compte » (il faut retaper « supprimer » pour confirmer). C&apos;est immédiat et définitif : votre compte, vos
    fiches de serveurs (avec leurs images, statistiques et signalements reçus), vos notifications, vos amis, votre
    présence en ligne, les serveurs que vous suiviez, vos avertissements et notes de modération sont effacés. Restent
    seulement, liés à votre identifiant Minecraft, les signalements que vous avez déposés sur les fiches d&apos;autres
    propriétaires, jusqu&apos;à la suppression de ces fiches : pour les faire effacer aussi, écrivez-nous. Vous pouvez
    aussi demander la suppression par e-mail à <Mail />.
    {" "}Si le launcher était connecté, il vous déconnecte dans la minute et ne recrée pas votre compte tout seul :
    pour cela, nous gardons seulement une empreinte chiffrée de votre identifiant Minecraft et la date de suppression.
    Un nouveau compte n&apos;est créé que si vous vous reconnectez avec Microsoft, sur le site ou dans le launcher, ou
    si vous envoyez une demande d&apos;ami depuis le launcher ; l&apos;empreinte est alors effacée.
  </p>
);

const DeletionEn = () => (
  <p>
    <B>Delete your account yourself</B>: sign in on the website, then Dashboard, Settings, &quot;Delete my account&quot;
    (you must type the confirmation word). It is immediate and permanent: your account, your server listings (with
    their images, statistics and received reports), your notifications, your friends, your
    online presence, the servers you followed, your warnings and moderation notes are erased. Only the reports you
    filed on other owners&apos; listings remain, tied to your Minecraft identifier, until those listings are deleted:
    write to us to have them erased too. You can also ask for deletion by email at <Mail />.
    {" "}If the launcher was signed in, it signs you out within a minute and does not recreate your account on its
    own: for that, we only keep an encrypted fingerprint of your Minecraft identifier and the deletion date. A new
    account is only created if you sign in with Microsoft again, on the website or in the launcher, or send a friend
    request from the launcher; the fingerprint is then erased.
  </p>
);

const INTRO = {
  fr: (
    <>
      Omniscient est un <B>projet personnel et gratuit</B>, édité par {LEGAL_EDITOR}. Il n&apos;existe pas encore de
      société. Ce texte est une <B>version provisoire</B> : il décrit honnêtement ce que font aujourd&apos;hui le site et le
      launcher, et il sera complété et mis à jour (création d&apos;une structure, nouvelles fonctions). Une question :{" "}
      <Mail />.
    </>
  ),
  en: (
    <>
      Omniscient is a <B>free, personal project</B> run by {LEGAL_EDITOR}. There is no company yet. This text is a{" "}
      <B>provisional version</B>: it honestly describes what the website and the launcher do today, and it will be
      completed and updated (creation of a legal entity, new features). Any question: <Mail />.
    </>
  ),
};

export function privacyPolicy(locale: Locale): LegalPage {
  if (locale === "en") return privacyEn();
  return {
    title: "Politique de confidentialité (RGPD)",
    updated: UPDATED.fr,
    intro: INTRO.fr,
    sections: [
      {
        title: "1. Qui est responsable de vos données ?",
        body: (
          <p>
            {LEGAL_EDITOR}, éditeur d&apos;Omniscient (personne physique, sans société à ce jour). Contact pour vos données :{" "}
            <Mail />. Cette politique couvre le site omniscientlauncher.com, l&apos;application Omniscient Launcher et
            leur API.
          </p>
        ),
      },
      {
        title: "2. En bref",
        body: (
          <List
            items={[
              <>
                Vous vous connectez <B>uniquement avec Microsoft</B>. Nous ne recevons ni votre e-mail, ni votre mot de
                passe, ni votre profil Microsoft : seulement votre <B>pseudo et votre identifiant Minecraft (UUID)</B>.
              </>,
              <>
                Aucun outil de mesure d&apos;audience fourni par un tiers, aucune publicité, aucun traceur. Nous comptons
                nous-mêmes, <B>sans cookie et sans savoir qui vous êtes</B>, les vues des fiches et les lancements de
                serveurs (voir 3).
              </>,
              <>Nous ne vendons ni ne louons vos données.</>,
              <>
                Si vous <B>publiez un serveur</B>, votre identifiant Minecraft (UUID) est public.
              </>,
              <>
                Se connecter au <B>launcher</B> avec Microsoft crée automatiquement un compte Omniscient (pseudo et
                UUID), même sans passer par le site. Le launcher indique alors à vos amis si vous êtes en ligne (voir 3).
              </>,
            ]}
          />
        ),
      },
      {
        title: "3. Les données que nous traitons",
        body: (
          <List
            items={[
              <>
                <B>Compte</B> : pseudo et UUID Minecraft, identifiant interne, date de création ; cookie de session pour
                rester connecté. Il est créé à votre première connexion sur le site, ou automatiquement quand vous vous
                connectez au launcher avec Microsoft. But : faire fonctionner votre compte. Le pseudo est mis à jour à
                chaque connexion, à partir de votre profil Minecraft vérifié auprès de Mojang.
              </>,
              <>
                <B>Présence en ligne</B> : tant que le launcher est ouvert et connecté, il nous envoie un signal toutes
                les 60 secondes avec votre identifiant Minecraft. Nous gardons seulement la date et l&apos;heure du
                dernier signal. But : montrer à vos amis acceptés si vous êtes en ligne (dernier signal il y a moins de
                2 minutes). Ce signal ne peut pas être coupé pour l&apos;instant, sauf en vous déconnectant du launcher.
              </>,
              <>
                <B>Amis</B> : les demandes d&apos;ami (qui l&apos;a envoyée, à qui, date, en attente ou acceptée). Une
                demande se fait par pseudo, depuis le site ou le launcher. La personne à qui vous envoyez une demande
                voit votre pseudo ; vos amis acceptés voient aussi votre identifiant Minecraft et si vous êtes en ligne.
                But : la liste d&apos;amis. Vous pouvez refuser une demande ou retirer un ami à tout moment.
              </>,
              <>
                <B>Serveurs suivis</B> : quand vous suivez un serveur dans le launcher, nous enregistrons votre
                identifiant Minecraft, le serveur, si vous voulez être prévenu de son retour en ligne et son dernier état
                connu (en ligne ou non). But : vous envoyer cette notification.
              </>,
              <>
                <B>Fiches de serveurs (propriétaires)</B> : nom, description, adresse du serveur, version, modpack, liens,
                images envoyées depuis le formulaire. Les fiches publiques sont visibles de tous et l&apos;UUID du
                propriétaire est fourni par l&apos;API publique ; comme il permet de retrouver le pseudo, considérez que
                votre identité de joueur est publique si vous publiez un serveur.
              </>,
              <>
                <B>Statistiques des fiches</B> : à chaque ouverture d&apos;une fiche publique sur le site et à chaque
                lancement d&apos;un serveur depuis le launcher, nous enregistrons le serveur concerné, le type
                d&apos;événement (vue ou lancement), la date et l&apos;heure, ainsi que les totaux. Ni adresse IP, ni
                identité, ni cookie. But : montrer ces chiffres au propriétaire (page « Activité »).
              </>,
              <>
                <B>Nombre de joueurs en ligne</B> : le site interroge le serveur de jeu ; seule la dernière mesure est
                gardée.
              </>,
              <>
                <B>Signalements</B> : pseudo et UUID de la personne qui signale, catégorie, message, lien de preuve
                éventuel, versions du jeu et du launcher, réponse du propriétaire. Un problème technique est transmis au
                propriétaire du serveur, qui voit votre pseudo, votre message et les versions. Un signalement de
                comportement ou de contenu n&apos;est <B>jamais</B> transmis au propriétaire : seule l&apos;équipe de
                modération d&apos;Omniscient le voit.
              </>,
              <>
                <B>Notifications</B> (cloche du launcher) : UUID du destinataire, nom du serveur, type, message.
              </>,
              <>
                <B>Modération</B> : avertissements, blocage éventuel d&apos;un compte (date, motif, auteur), historique
                des recours sur une fiche, notes internes de l&apos;équipe (communiquées au joueur seulement s&apos;il
                demande l&apos;accès à ses données, après relecture pour protéger les autres personnes citées). But :
                appliquer les règles et traiter les recours.
              </>,
              <>
                <B>Formulaire de contact et e-mails</B> : nom, adresse e-mail, sujet et message, pour vous répondre.
                Votre adresse IP sert seulement, en mémoire, à limiter l&apos;envoi à 5 messages par heure.
              </>,
              <>
                <B>Compte supprimé</B> : une empreinte chiffrée (SHA-256) de votre identifiant Minecraft et la date de
                suppression, rien d&apos;autre. But : que le launcher ne recrée pas votre compte tout seul (voir 9).
              </>,
              <>
                <B>Données techniques</B> : l&apos;hébergeur du site (Vercel) enregistre automatiquement des données
                techniques, dont votre adresse IP, pour le fonctionnement et la sécurité. Nous utilisons aussi votre
                adresse IP, en mémoire et pendant quelques minutes seulement, pour limiter les envois abusifs.
              </>,
            ]}
          />
        ),
      },
      {
        title: "4. Le launcher, sur votre ordinateur",
        body: (
          <List
            items={[
              <>
                La <B>connexion Microsoft / Xbox / Minecraft</B> se fait directement entre votre ordinateur et
                Microsoft. Si vous choisissez « se souvenir de moi », un jeton de reconnexion est gardé sur votre
                ordinateur, chiffré par Windows.
              </>,
              <>
                Pour prouver votre identité, le launcher transmet votre <B>jeton d&apos;accès Minecraft</B> à nos
                serveurs, qui le présentent à Mojang puis le gardent <B>en mémoire au plus 5 minutes</B>, sans
                l&apos;enregistrer.
              </>,
              <>
                Vos paramètres, favoris, derniers serveurs joués et journaux <B>restent sur votre ordinateur</B> et ne
                nous sont pas transmis. Les journaux (un fichier par jour) y restent jusqu&apos;à ce que vous les
                effaciez.
              </>,
              <>
                <B>Discord</B> : si Discord est ouvert sur votre ordinateur, le launcher y affiche « Joue à Omniscient
                Launcher », avec en dessous « Parcourt les serveurs », ou le nom du serveur que vous avez rejoint et
                celui de son modpack. Pour un serveur privé, il affiche seulement « Joue sur un serveur privé », sans
                nom ni modpack. Cela passe par votre application Discord et devient visible sur votre profil Discord,
                selon vos réglages Discord (« Partager mon activité »). Rien n&apos;est transmis à Omniscient. Vous
                pouvez tout couper dans le launcher : Paramètres, Divers, « Afficher mon activité sur Discord »
                (activé par défaut).
              </>,
              <>
                Le launcher contacte directement des services tiers, qui voient votre adresse IP : Mojang, les dépôts des
                chargeurs de mods, CurseForge et Modrinth (modpacks), Eclipse Adoptium (Java), GitHub (vérification de
                mise à jour à chaque démarrage), les services dont il affiche l&apos;état et Cloudflare si vous lancez le
                test de débit.
              </>,
              <>Quand vous rejoignez un serveur de jeu, celui-ci voit votre pseudo et votre adresse IP.</>,
            ]}
          />
        ),
      },
      {
        title: "5. Pourquoi nous avons le droit de les traiter",
        body: (
          <List
            items={[
              <>
                <B>Exécution du service</B> que vous utilisez (conditions d&apos;utilisation) : compte, fiches,
                signalements, notifications, connexion du launcher, amis, présence en ligne, serveurs suivis.
              </>,
              <>
                <B>Intérêt légitime</B> : statistiques anonymes des fiches, sécurité et lutte contre les abus,
                modération, données techniques d&apos;hébergement, réponse à vos messages, respect de votre demande de
                suppression (empreinte du compte supprimé).
              </>,
              <>
                <B>Obligation légale</B> : réponse aux demandes des autorités.
              </>,
            ]}
          />
        ),
      },
      {
        title: "6. Combien de temps",
        body: (
          <List
            items={[
              <>
                Compte, modération, notifications, amis et présence en ligne : tant que le compte existe ; effacés quand
                vous le supprimez (voir 9). Un ami retiré ou une demande refusée est effacé tout de suite.
              </>,
              <>Serveurs suivis : jusqu&apos;à ce que vous arrêtiez de suivre le serveur, que sa fiche soit supprimée ou que vous supprimiez votre compte.</>,
              <>Empreinte d&apos;un compte supprimé : jusqu&apos;à ce que vous reveniez sur Omniscient (voir 9).</>,
              <>
                Fiche, ses statistiques et ses signalements : tant que la fiche existe ; supprimés avec elle ou avec le
                compte. Vous pouvez supprimer vous-même vos notifications dans le launcher.
              </>,
              <>Cookie de session : jusqu&apos;à 30 jours.</>,
              <>Messages de contact : jusqu&apos;à leur suppression par nous ou à votre demande.</>,
              <>Données techniques de l&apos;hébergeur : selon sa propre politique.</>,
            ]}
          />
        ),
      },
      {
        title: "7. Qui reçoit vos données",
        body: (
          <List
            items={[
              <>
                <B>Vercel Inc.</B> : hébergement du site et de l&apos;API (fonctions exécutées à Paris).
              </>,
              <>
                <B>Cloudflare, Inc.</B> : base de données, stockage des images et tâches planifiées.
              </>,
              <>
                <B>Microsoft</B> (Xbox Live, Minecraft) : connexion, en tant que responsable distinct de votre compte
                Microsoft.
              </>,
              <>
                <B>Google</B> (Gmail) : réception et envoi des e-mails échangés avec nous, dont les réponses au
                formulaire de contact.
              </>,
              <>
                <B>GitHub</B> (Microsoft) : hébergement des versions du launcher ; voit votre adresse IP quand le
                launcher vérifie ou télécharge une mise à jour.
              </>,
              <>Les propriétaires de serveurs, pour les signalements techniques qui les concernent.</>,
              <>Vos amis acceptés, pour votre identifiant Minecraft et votre présence en ligne.</>,
              <>L&apos;équipe de modération d&apos;Omniscient.</>,
              <>Les autorités, sur demande légale.</>,
            ]}
          />
        ),
      },
      {
        title: "8. Transferts hors de l'Union européenne",
        body: (
          <p>
            Vercel, Cloudflare, Google et GitHub sont des sociétés américaines : l&apos;accès de leurs équipes ou
            l&apos;acheminement du trafic peut impliquer les États-Unis. Ces transferts sont encadrés par les garanties de ces prestataires
            (Data Privacy Framework UE–États-Unis et clauses contractuelles types).
          </p>
        ),
      },
      {
        title: "9. Vos droits",
        body: (
          <>
            <p>
              Vous pouvez demander l&apos;accès à vos données, leur rectification, leur effacement (dont la suppression
              de votre compte), la limitation du traitement, vous opposer à un traitement fondé sur l&apos;intérêt
              légitime, demander la portabilité de vos données et donner des directives pour après votre décès.
            </p>
            <p>
              Écrivez à <Mail /> (objet « Données personnelles ») ou utilisez le{" "}
              <Link href="/contact" className="text-foreground underline underline-offset-2">formulaire de contact</Link>.
              Nous pouvons vous demander de prouver que le compte est bien le vôtre. Réponse sous un mois. Pour une
              demande d&apos;accès, nous vous envoyons par e-mail un résumé lisible et un fichier complet (JSON) : votre
              compte, vos fiches, les signalements envoyés et reçus (sans l&apos;identité de leurs auteurs), vos
              notifications, avertissements, amis, dernière présence en ligne et serveurs suivis, et, après relecture,
              les notes de l&apos;équipe vous concernant. Vos messages envoyés par le formulaire de contact sont
              ajoutés seulement si la demande vient de la même adresse e-mail. N&apos;y figurent jamais : les jetons de
              connexion, les codes d&apos;invitation des serveurs privés, l&apos;identité des personnes qui ont signalé
              vos serveurs, ni les noms de connexion de l&apos;équipe. Vous
              pouvez aussi saisir l&apos;Autorité de protection des données belge (www.autoriteprotectiondonnees.be),
              ou l&apos;autorité de protection des données de votre pays (en France, la CNIL).
            </p>
            <DeletionFr />
          </>
        ),
      },
      {
        title: "10. Mineurs",
        body: (
          <p>
            Omniscient est ouvert à partir de 13 ans ; avant 15 ans, l&apos;accord d&apos;un parent est nécessaire. Si
            vous pensez qu&apos;un enfant de moins de 13 ans nous a transmis des données, écrivez-nous : nous les
            supprimerons.
          </p>
        ),
      },
      {
        title: "11. Sécurité",
        body: (
          <p>
            Connexion chiffrée (HTTPS), aucun mot de passe stocké, jetons du launcher chiffrés sur votre ordinateur,
            accès aux données limité. Aucun système n&apos;est infaillible : en cas de fuite présentant un risque, nous
            préviendrons l&apos;Autorité de protection des données et, si nécessaire, les personnes concernées.
          </p>
        ),
      },
      {
        title: "12. Cookies et stockage local",
        body: (
          <>
            <p>Le site n&apos;utilise que des éléments nécessaires à son fonctionnement ; aucun consentement n&apos;est donc demandé.</p>
            <List
              items={[
                <>Cookie de session (connexion) : jusqu&apos;à 30 jours.</>,
                <>Cookies techniques de connexion Microsoft (sécurité de la connexion) : quelques minutes.</>,
                <>« NEXT_LOCALE » (langue choisie) : 1 an.</>,
                <>« theme » (thème clair ou sombre, stockage local du navigateur) : jusqu&apos;à ce que vous l&apos;effaciez.</>,
              ]}
            />
            <p>Le comptage des vues des fiches n&apos;utilise aucun cookie ni aucun stockage sur votre appareil.</p>
          </>
        ),
      },
      {
        title: "13. Modifications",
        body: (
          <p>
            Cette politique sera mise à jour, notamment à l&apos;ajout de nouvelles fonctions. La date figure en haut de
            la page. Voir aussi les <Link href="/cgu" className="text-foreground underline underline-offset-2">conditions d&apos;utilisation</Link>.
          </p>
        ),
      },
    ],
  };
}

function privacyEn(): LegalPage {
  return {
    title: "Privacy policy (GDPR)",
    updated: UPDATED.en,
    intro: INTRO.en,
    sections: [
      {
        title: "1. Who is responsible for your data?",
        body: (
          <p>
            {LEGAL_EDITOR}, publisher of Omniscient (an individual, no company yet). Contact for your data: <Mail />.
            This policy covers the omniscientlauncher.com website, the Omniscient Launcher application and their API.
          </p>
        ),
      },
      {
        title: "2. In short",
        body: (
          <List
            items={[
              <>
                You sign in <B>only with Microsoft</B>. We never receive your email, password or Microsoft profile: only
                your <B>Minecraft username and identifier (UUID)</B>.
              </>,
              <>
                No third-party analytics tool, no advertising, no trackers. We count listing views and server launches
                ourselves, <B>without cookies and without knowing who you are</B> (see 3).
              </>,
              <>We never sell or rent your data.</>,
              <>
                If you <B>publish a server</B>, your Minecraft identifier (UUID) is public.
              </>,
              <>
                Signing in to the <B>launcher</B> with Microsoft automatically creates an Omniscient account (username
                and UUID), even without using the website. The launcher then tells your friends whether you are online
                (see 3).
              </>,
            ]}
          />
        ),
      },
      {
        title: "3. The data we process",
        body: (
          <List
            items={[
              <>
                <B>Account</B>: Minecraft username and UUID, internal identifier, creation date; a session cookie to
                keep you signed in. It is created the first time you sign in on the website, or automatically when you
                sign in to the launcher with Microsoft. Purpose: running your account. Your username is updated at each
                sign-in, from your Minecraft profile as verified with Mojang.
              </>,
              <>
                <B>Online presence</B>: while the launcher is open and signed in, it sends us a signal every 60 seconds
                with your Minecraft identifier. We only keep the date and time of the latest signal. Purpose: showing
                your accepted friends whether you are online (latest signal less than 2 minutes ago). This signal cannot
                be turned off for now, except by signing out of the launcher.
              </>,
              <>
                <B>Friends</B>: friend requests (who sent it, to whom, date, pending or accepted). A request is made by
                username, from the website or the launcher. The person you send a request to sees your username; your
                accepted friends also see your Minecraft identifier and whether you are online. Purpose: the friends
                list. You can decline a request or remove a friend at any time.
              </>,
              <>
                <B>Followed servers</B>: when you follow a server in the launcher, we record your Minecraft identifier,
                the server, whether you want to be told when it is back online, and its last known state (online or
                not). Purpose: sending you that notification.
              </>,
              <>
                <B>Server listings (owners)</B>: name, description, server address, version, modpack, links, images
                uploaded through the form. Public listings are visible to everyone and the owner&apos;s UUID is provided by
                the public API; since it reveals the username, consider your player identity public if you publish a
                server.
              </>,
              <>
                <B>Listing statistics</B>: each time a public listing is opened on the website and each time a server
                is launched from the launcher, we record the server, the event type (view or launch), the date and
                time, plus the totals. No IP address, no identity, no cookie. Purpose: showing these figures to the
                owner (&quot;Activity&quot; page).
              </>,
              <>
                <B>Players online</B>: the website queries the game server; only the latest measurement is kept.
              </>,
              <>
                <B>Reports</B>: username and UUID of the reporter, category, message, optional proof link, game and
                launcher versions, the owner&apos;s reply. A technical issue goes to the server owner, who sees your
                username, message and versions. A behaviour or content report is <B>never</B> sent to the owner: only
                the Omniscient moderation team sees it.
              </>,
              <>
                <B>Notifications</B> (launcher bell): recipient UUID, server name, type, message.
              </>,
              <>
                <B>Moderation</B>: warnings, possible account lock (date, reason, author), appeal history for a listing,
                internal team notes (shared with the player only if they request access to their data, after review to
                protect other people mentioned). Purpose: enforcing the rules and handling appeals.
              </>,
              <>
                <B>Contact form and emails</B>: name, email address, subject and message, to answer you. Your IP
                address is only used, in memory, to limit sending to 5 messages per hour.
              </>,
              <>
                <B>Deleted account</B>: an encrypted fingerprint (SHA-256) of your Minecraft identifier and the deletion
                date, nothing else. Purpose: making sure the launcher does not recreate your account on its own (see 9).
              </>,
              <>
                <B>Technical data</B>: the website host (Vercel) automatically records technical data, including your IP
                address, for operation and security. We also use your IP address, in memory and for a few minutes only,
                to limit abuse.
              </>,
            ]}
          />
        ),
      },
      {
        title: "4. The launcher, on your computer",
        body: (
          <List
            items={[
              <>
                <B>Microsoft / Xbox / Minecraft sign-in</B> happens directly between your computer and Microsoft. If you
                choose &quot;remember me&quot;, a refresh token is kept on your computer, encrypted by Windows.
              </>,
              <>
                To prove your identity, the launcher sends your <B>Minecraft access token</B> to our servers, which
                present it to Mojang and keep it <B>in memory for at most 5 minutes</B>, without storing it.
              </>,
              <>
                Your settings, favourites, recently played servers and logs <B>stay on your computer</B> and are not
                sent to us. Logs (one file per day) stay there until you delete them.
              </>,
              <>
                <B>Discord</B>: if Discord is running on your computer, the launcher shows &quot;Playing Omniscient
                Launcher&quot; with &quot;Browsing servers&quot; underneath, or the name of the server you joined and of
                its modpack. For a private server, it only shows &quot;Playing on a private server&quot;, with no name
                or modpack. This goes through your Discord app and becomes visible on your Discord profile, depending on
                your Discord settings (&quot;Share my activity&quot;). Nothing is sent to Omniscient. You can turn it
                all off in the launcher: Settings, Misc, &quot;Show my activity on Discord&quot; (on by default).
              </>,
              <>
                The launcher connects directly to third-party services, which see your IP address: Mojang, mod loader
                repositories, CurseForge and Modrinth (modpacks), Eclipse Adoptium (Java), GitHub (update check at each
                start), the services whose status it shows, and Cloudflare if you run the speed test.
              </>,
              <>When you join a game server, that server sees your username and IP address.</>,
            ]}
          />
        ),
      },
      {
        title: "5. Legal bases",
        body: (
          <List
            items={[
              <>
                <B>Performance of the service</B> you use (terms of use): account, listings, reports, notifications,
                launcher sign-in, friends, online presence, followed servers.
              </>,
              <>
                <B>Legitimate interest</B>: anonymous listing statistics, security and abuse prevention, moderation,
                hosting technical data, answering your messages, honouring your deletion request (deleted account
                fingerprint).
              </>,
              <>
                <B>Legal obligation</B>: answering requests from the authorities.
              </>,
            ]}
          />
        ),
      },
      {
        title: "6. How long",
        body: (
          <List
            items={[
              <>
                Account, moderation, notifications, friends and online presence: as long as the account exists; erased
                when you delete it (see 9). A removed friend or a declined request is erased immediately.
              </>,
              <>Followed servers: until you stop following the server, its listing is deleted, or you delete your account.</>,
              <>Deleted account fingerprint: until you come back to Omniscient (see 9).</>,
              <>
                A listing, its statistics and its reports: as long as the listing exists; deleted with it or with the
                account. You can delete your notifications yourself in the launcher.
              </>,
              <>Session cookie: up to 30 days.</>,
              <>Contact messages: until we delete them or you ask us to.</>,
              <>Host technical data: according to the host&apos;s own policy.</>,
            ]}
          />
        ),
      },
      {
        title: "7. Who receives your data",
        body: (
          <List
            items={[
              <>
                <B>Vercel Inc.</B>: hosting of the website and API (functions run in Paris).
              </>,
              <>
                <B>Cloudflare, Inc.</B>: database, image storage and scheduled tasks.
              </>,
              <>
                <B>Microsoft</B> (Xbox Live, Minecraft): sign-in, as an independent controller of your Microsoft
                account.
              </>,
              <>
                <B>Google</B> (Gmail): receiving and sending the emails exchanged with us, including replies to the
                contact form.
              </>,
              <>
                <B>GitHub</B> (Microsoft): hosting of launcher releases; sees your IP address when the launcher checks
                for or downloads an update.
              </>,
              <>Server owners, for technical reports about their server.</>,
              <>Your accepted friends, for your Minecraft identifier and online presence.</>,
              <>The Omniscient moderation team.</>,
              <>Authorities, upon legal request.</>,
            ]}
          />
        ),
      },
      {
        title: "8. Transfers outside the European Union",
        body: (
          <p>
            Vercel, Cloudflare, Google and GitHub are US companies: access by their staff or traffic routing may
            involve the United States. These transfers are covered by these providers&apos; safeguards (EU–US Data Privacy Framework and
            standard contractual clauses).
          </p>
        ),
      },
      {
        title: "9. Your rights",
        body: (
          <>
            <p>
              You can ask to access, rectify or erase your data (including deleting your account), restrict processing,
              object to processing based on legitimate interest, receive your data (portability) and give instructions
              for after your death.
            </p>
            <p>
              Write to <Mail /> (subject &quot;Personal data&quot;) or use the{" "}
              <Link href="/contact" className="text-foreground underline underline-offset-2">contact form</Link>. We may
              ask you to prove the account is yours. Answer within one month. For an access request, we email you a
              readable summary and a complete file (JSON): your account, your listings, the reports you sent and received
              (without their authors&apos; identity), your notifications, warnings, friends, last online presence and
              followed servers, and, after review, the team notes about you. Messages you sent through the contact form
              are only added if the request comes from the same email address. Never included: sign-in tokens, private
              server invite codes, the identity of people who reported your servers, or the team&apos;s login names. You can also complain to the Belgian Data Protection Authority
              (www.dataprotectionauthority.be), or to the data protection authority of your own country (in France, the
              CNIL).
            </p>
            <DeletionEn />
          </>
        ),
      },
      {
        title: "10. Minors",
        body: (
          <p>
            Omniscient is open from age 13; under 15, a parent&apos;s consent is required. If you believe a child under 13
            has sent us data, write to us and we will delete it.
          </p>
        ),
      },
      {
        title: "11. Security",
        body: (
          <p>
            Encrypted connection (HTTPS), no password stored, launcher tokens encrypted on your computer, limited access
            to data. No system is foolproof: if a breach creates a risk, we will notify the Data Protection Authority and,
            where needed, the people concerned.
          </p>
        ),
      },
      {
        title: "12. Cookies and local storage",
        body: (
          <>
            <p>The website only uses what it needs to work, so no consent is requested.</p>
            <List
              items={[
                <>Session cookie (sign-in): up to 30 days.</>,
                <>Technical Microsoft sign-in cookies (sign-in security): a few minutes.</>,
                <>&quot;NEXT_LOCALE&quot; (chosen language): 1 year.</>,
                <>&quot;theme&quot; (light or dark theme, browser local storage): until you clear it.</>,
              ]}
            />
            <p>Counting listing views uses no cookie and no storage on your device.</p>
          </>
        ),
      },
      {
        title: "13. Changes",
        body: (
          <p>
            This policy will be updated, especially when new features are added. The date is shown at the top of the
            page. See also the <Link href="/cgu" className="text-foreground underline underline-offset-2">terms of use</Link>.
          </p>
        ),
      },
    ],
  };
}

export function termsOfUse(locale: Locale): LegalPage {
  if (locale === "en") return termsEn();
  return {
    title: "Conditions générales d'utilisation (CGU)",
    updated: UPDATED.fr,
    intro: INTRO.fr,
    sections: [
      {
        title: "1. Objet",
        body: (
          <p>
            Omniscient est un annuaire de serveurs Minecraft (le site omniscientlauncher.com) et une application pour
            les rejoindre (Omniscient Launcher). En utilisant le site ou le launcher, vous acceptez ces conditions.
          </p>
        ),
      },
      {
        title: "2. Un service gratuit",
        body: (
          <p>
            Omniscient est <B>gratuit</B> pour le moment ; aucune offre payante n&apos;existe. Si des offres payantes
            apparaissent un jour, elles auront leurs propres conditions, que vous devrez accepter séparément.
          </p>
        ),
      },
      {
        title: "3. Qui édite Omniscient",
        body: (
          <p>
            Omniscient est un projet personnel de {LEGAL_EDITOR}, sans société à ce jour. Contact : <Mail />. Le site est
            hébergé par Vercel Inc. (440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis) et ses données par
            Cloudflare, Inc. (101 Townsend Street, San Francisco, CA 94107, États-Unis).
          </p>
        ),
      },
      {
        title: "4. Pas un produit officiel Minecraft",
        body: (
          <p>
            Omniscient n&apos;est pas un produit officiel Minecraft. Il n&apos;est ni approuvé par Mojang ou Microsoft, ni
            associé à eux. « Minecraft » est une marque de Mojang AB. Pour jouer, vous devez posséder un compte
            Minecraft légitime et respecter les conditions de Mojang et Microsoft.
          </p>
        ),
      },
      {
        title: "5. Omniscient n'exploite pas les serveurs listés",
        body: (
          <p>
            Les serveurs de jeu appartiennent à leurs propriétaires, qui sont seuls responsables de leur serveur, de ses
            règles, de son contenu et des sanctions en jeu. Omniscient se contente de les présenter et de vous aider à
            les rejoindre.
          </p>
        ),
      },
      {
        title: "6. Votre compte",
        body: (
          <p>
            La connexion se fait avec votre compte Microsoft. Omniscient est ouvert à partir de 13 ans ; avant 15 ans,
            l&apos;accord d&apos;un parent est nécessaire. Vous êtes responsable de ce qui est fait avec votre compte.
          </p>
        ),
      },
      {
        title: "7. Ce qui est interdit",
        body: (
          <List
            items={[
              <>publier un contenu illégal, haineux, violent, sexuel impliquant des mineurs, ou qui harcèle quelqu&apos;un ;</>,
              <>arnaquer, hameçonner, diffuser un logiciel malveillant ou tromper les joueurs (fiche mensongère) ;</>,
              <>usurper l&apos;identité d&apos;une personne ou d&apos;un serveur ;</>,
              <>utiliser des textes ou images sans en avoir le droit ;</>,
              <>envoyer des demandes d&apos;amis en masse ou à quelqu&apos;un qui les refuse ;</>,
              <>abuser des signalements, contourner la sécurité ou surcharger le service ou son API.</>,
            ]}
          />
        ),
      },
      {
        title: "8. Fiches de serveurs",
        body: (
          <p>
            Si vous publiez un serveur, vous garantissez que les informations sont exactes et que vous avez le droit
            d&apos;utiliser les textes et images envoyés. Vous gardez vos droits sur ce contenu et autorisez Omniscient à
            l&apos;afficher gratuitement sur le site et dans le launcher tant que la fiche existe.
          </p>
        ),
      },
      {
        title: "9. Modération",
        body: (
          <p>
            En cas de non-respect de ces règles, Omniscient peut retirer ou masquer une fiche, envoyer un avertissement,
            geler un serveur ou bloquer un compte. Le propriétaire concerné est informé du motif et peut faire un
            recours. Vous pouvez signaler un problème depuis le launcher, ou un contenu illicite par e-mail à <Mail /> ou
            via le <Link href="/contact" className="text-foreground underline underline-offset-2">formulaire de contact</Link>.
          </p>
        ),
      },
      {
        title: "10. Le launcher",
        body: (
          <>
            <p>
              Le launcher installe le jeu, Java et, si besoin, les mods et modpacks téléchargés depuis des services
              tiers (Mojang, CurseForge, Modrinth…). Il est fourni tel quel, sans garantie de compatibilité avec chaque
              configuration.
            </p>
            <p>
              Se connecter au launcher crée votre compte Omniscient s&apos;il n&apos;existe pas. Le launcher propose des
              amis : une demande doit être acceptée par l&apos;autre joueur, et seuls vos amis acceptés voient si vous
              êtes en ligne. Vous pouvez refuser une demande ou retirer un ami à tout moment. Il peut aussi afficher
              votre activité sur Discord, ce que vous pouvez couper dans Paramètres, Divers.
            </p>
          </>
        ),
      },
      {
        title: "11. Responsabilité",
        body: (
          <p>
            Omniscient est fourni gratuitement, tel quel, sans garantie de disponibilité continue. Dans les limites
            permises par la loi, Omniscient n&apos;est pas responsable des serveurs de jeu, de leur contenu, ni des
            services tiers.
          </p>
        ),
      },
      {
        title: "12. Arrêt et suppression du compte",
        body: (
          <>
            <p>
              Vous pouvez arrêter d&apos;utiliser Omniscient à tout moment. Omniscient peut fermer un compte qui ne
              respecte pas ces conditions.
            </p>
            <DeletionFr />
          </>
        ),
      },
      {
        title: "13. Données personnelles",
        body: (
          <p>
            Voir la{" "}
            <Link href="/confidentialite" className="text-foreground underline underline-offset-2">
              politique de confidentialité (RGPD)
            </Link>
            .
          </p>
        ),
      },
      {
        title: "14. Modifications et droit applicable",
        body: (
          <p>
            Ces conditions seront mises à jour ; la date figure en haut de la page. Elles sont soumises au droit
            belge. En cas de désaccord, écrivez-nous d&apos;abord : nous chercherons une solution amiable. À défaut, les
            tribunaux belges sont compétents. Si vous êtes un consommateur, vous gardez les droits protecteurs de la loi
            de votre pays et pouvez saisir les tribunaux de chez vous.
          </p>
        ),
      },
    ],
  };
}

function termsEn(): LegalPage {
  return {
    title: "Terms of use",
    updated: UPDATED.en,
    intro: INTRO.en,
    sections: [
      {
        title: "1. Purpose",
        body: (
          <p>
            Omniscient is a directory of Minecraft servers (the omniscientlauncher.com website) and an application to
            join them (Omniscient Launcher). By using the website or the launcher, you accept these terms.
          </p>
        ),
      },
      {
        title: "2. A free service",
        body: (
          <p>
            Omniscient is <B>free</B> for now; there is no paid offer. If paid offers ever appear, they will have their
            own terms, which you will have to accept separately.
          </p>
        ),
      },
      {
        title: "3. Who runs Omniscient",
        body: (
          <p>
            Omniscient is a personal project by {LEGAL_EDITOR}, with no company yet. Contact: <Mail />. The website is
            hosted by Vercel Inc. (440 N Barranca Avenue #4133, Covina, CA 91723, USA) and its data by Cloudflare, Inc.
            (101 Townsend Street, San Francisco, CA 94107, USA).
          </p>
        ),
      },
      {
        title: "4. Not an official Minecraft product",
        body: (
          <p>
            Omniscient is not an official Minecraft product. It is not approved by or associated with Mojang or
            Microsoft. &quot;Minecraft&quot; is a trademark of Mojang AB. To play, you need a legitimate Minecraft account
            and must follow Mojang&apos;s and Microsoft&apos;s terms.
          </p>
        ),
      },
      {
        title: "5. Omniscient does not run the listed servers",
        body: (
          <p>
            Game servers belong to their owners, who are solely responsible for their server, its rules, its content and
            in-game sanctions. Omniscient only presents them and helps you join them.
          </p>
        ),
      },
      {
        title: "6. Your account",
        body: (
          <p>
            You sign in with your Microsoft account. Omniscient is open from age 13; under 15, a parent&apos;s consent is
            required. You are responsible for what is done with your account.
          </p>
        ),
      },
      {
        title: "7. What is forbidden",
        body: (
          <List
            items={[
              <>publishing illegal, hateful or violent content, sexual content involving minors, or harassing anyone;</>,
              <>scamming, phishing, spreading malware or misleading players (false listing);</>,
              <>impersonating a person or a server;</>,
              <>using texts or images you have no right to use;</>,
              <>sending friend requests in bulk, or to someone who keeps declining them;</>,
              <>abusing reports, bypassing security or overloading the service or its API.</>,
            ]}
          />
        ),
      },
      {
        title: "8. Server listings",
        body: (
          <p>
            If you publish a server, you guarantee that the information is accurate and that you have the right to use
            the texts and images you upload. You keep your rights on this content and allow Omniscient to display it for
            free on the website and in the launcher for as long as the listing exists.
          </p>
        ),
      },
      {
        title: "9. Moderation",
        body: (
          <p>
            If these rules are broken, Omniscient may remove or hide a listing, issue a warning, freeze a server or lock
            an account. The owner concerned is told why and can appeal. You can report a problem from the launcher, or
            illegal content by email to <Mail /> or through the{" "}
            <Link href="/contact" className="text-foreground underline underline-offset-2">contact form</Link>.
          </p>
        ),
      },
      {
        title: "10. The launcher",
        body: (
          <>
            <p>
              The launcher installs the game, Java and, when needed, mods and modpacks downloaded from third-party
              services (Mojang, CurseForge, Modrinth…). It is provided as is, with no guarantee of compatibility with
              every setup.
            </p>
            <p>
              Signing in to the launcher creates your Omniscient account if it does not exist yet. The launcher offers
              friends: a request must be accepted by the other player, and only your accepted friends can see whether
              you are online. You can decline a request or remove a friend at any time. It can also show your activity
              on Discord, which you can turn off in Settings, Misc.
            </p>
          </>
        ),
      },
      {
        title: "11. Liability",
        body: (
          <p>
            Omniscient is provided free of charge, as is, with no guarantee of continuous availability. To the extent
            permitted by law, Omniscient is not responsible for game servers, their content, or third-party services.
          </p>
        ),
      },
      {
        title: "12. Leaving and account deletion",
        body: (
          <>
            <p>You can stop using Omniscient at any time. Omniscient may close an account that breaks these terms.</p>
            <DeletionEn />
          </>
        ),
      },
      {
        title: "13. Personal data",
        body: (
          <p>
            See the{" "}
            <Link href="/confidentialite" className="text-foreground underline underline-offset-2">
              privacy policy (GDPR)
            </Link>
            .
          </p>
        ),
      },
      {
        title: "14. Changes and governing law",
        body: (
          <p>
            These terms will be updated; the date is shown at the top of the page. They are governed by Belgian law. If
            you disagree with something, write to us first and we will look for an amicable solution; failing that, the
            Belgian courts have jurisdiction. If you are a consumer, you keep the mandatory protections of the law of your
            country and may go to the courts where you live.
          </p>
        ),
      },
    ],
  };
}
