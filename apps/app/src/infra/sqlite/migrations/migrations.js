// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from "./20261029074425_device/migration.sql";
import m0001 from "./20261029143412_sealed/migration.sql";
import m0002 from "./20261107111859_profile_adult/migration.sql";
import m0003 from "./20261116114312_offering_choice_required/migration.sql";
import m0004 from "./20261117213626_local_refusals/migration.sql";
import m0005 from "./20261118185501_lessons/migration.sql";
import m0006 from "./20261118231419_gifted_moonstone/migration.sql";

export default {
  migrations: {
    "20261029074425_device": m0000,
    "20261029143412_sealed": m0001,
    "20261107111859_profile_adult": m0002,
    "20261116114312_offering_choice_required": m0003,
    "20261117213626_local_refusals": m0004,
    "20261118185501_lessons": m0005,
    "20261118231419_gifted_moonstone": m0006,
  },
};
