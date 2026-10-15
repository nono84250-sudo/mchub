; Desinstalleur : case "Supprimer mes donnees utilisateur" (demande de Rushi, 15/10).
; customUnInstallSection ajoute a electron-builder une page de composants au
; desinstalleur, avec cette section en case a cocher. /o = decochee par defaut :
; on garde les donnees sauf si le joueur coche la case lui-meme.
; Les donnees du launcher sont dans %APPDATA%\.omniscient-launcher (main.js,
; app.setPath("userData")) : instances et mondes (minecraft\), Java telecharge
; (runtime\), reglages (settings.json), compte connecte, logs.
; Jamais pendant une mise a jour : electron-updater relance l'ancien
; desinstalleur en silencieux avec --updated, la section reste alors decochee
; et isUpdated la bloque en plus.

!macro customUnInstallSection
  ; Texte fourni en anglais et en francais seulement : les autres langues de
  ; l'installateur prennent l'anglais (avertissement 6040 sinon bloquant).
  !pragma warning disable 6040
  LangString deleteUserDataSection ${LANG_ENGLISH} "Delete my user data (instances, worlds, settings, account) - permanent"
  LangString deleteUserDataSection ${LANG_FRENCH} "Supprimer mes données utilisateur (instances, mondes, réglages, compte) - définitif"

  Section /o "un.$(deleteUserDataSection)" un.deleteUserData
    ${ifNot} ${isUpdated}
      ; Les donnees Electron sont toujours par utilisateur, meme en installation pour tous.
      SetShellVarContext current
      DetailPrint "Suppression de $APPDATA\.omniscient-launcher"
      RMDir /r "$APPDATA\.omniscient-launcher"
      ; Ancien dossier par defaut d'Electron (avant le renommage en .omniscient-launcher).
      RMDir /r "$APPDATA\${PRODUCT_NAME}"
      ; Cache de telechargement d'electron-updater (nom du paquet "launcher").
      RMDir /r "$LOCALAPPDATA\launcher-updater"
    ${endIf}
  SectionEnd
!macroend
