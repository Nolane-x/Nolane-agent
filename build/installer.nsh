!include "FileFunc.nsh"

!macro customInit
  SetRegView 64
!macroend

!macro customInstall
  ; User data intentionally remains outside the install directory.
  ; The stable appId/GUID preserves upgrade and uninstall continuity.
  ; Only an updater-launched installation receives /UPDATED. The renderer
  ; cannot supply this switch or an executable path.
  ${GetParameters} $R0
  ${GetOptions} $R0 "/UPDATED" $R1
  IfErrors 0 nolane_update_relaunch
  ; Checkpoint 13 compatibility: the legacy controller used --updated.
  ${GetOptions} $R0 "--updated" $R1
  IfErrors nolane_no_update_relaunch
  nolane_update_relaunch:
    Exec '"$INSTDIR\NolaneAgent.exe" --post-update'
  nolane_no_update_relaunch:
!macroend

!macro customUnInstall
  ; Never delete Nolane mission, checkpoint, memory, or credential data.
!macroend
