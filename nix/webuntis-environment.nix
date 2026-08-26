{
  database,
  requiredSecrets,
}:
let
  credentials =
    if requiredSecrets then
      ''
        webuntis_username_file="$(project-context secret-file webUntisUsername --required)"
        webuntis_password_file="$(project-context secret-file webUntisPassword --required)"
        WEBUNTIS_USERNAME="$(<"$webuntis_username_file")"
        WEBUNTIS_PASSWORD="$(<"$webuntis_password_file")"
        export WEBUNTIS_USERNAME WEBUNTIS_PASSWORD
      ''
    else
      ''
        if webuntis_username_file="$(project-context secret-file webUntisUsername)"; then
          WEBUNTIS_USERNAME="$(<"$webuntis_username_file")"
          export WEBUNTIS_USERNAME
        fi
        if webuntis_password_file="$(project-context secret-file webUntisPassword)"; then
          WEBUNTIS_PASSWORD="$(<"$webuntis_password_file")"
          export WEBUNTIS_PASSWORD
        fi
      '';
in
''
  WEBUNTIS_SCHOOL_NAME="$(project-context parameter webUntisSchoolName)"
  WEBUNTIS_SCHOOL_LOGIN_NAME="$(project-context parameter webUntisSchoolLoginName)"
  WEBUNTIS_SERVER_URL="$(project-context parameter webUntisServerUrl)"
  WEBUNTIS_TENANT_ID="$(project-context parameter webUntisTenantId)"
  export WEBUNTIS_SCHOOL_NAME WEBUNTIS_SCHOOL_LOGIN_NAME WEBUNTIS_SERVER_URL WEBUNTIS_TENANT_ID

  ${credentials}
  ${database}
''
