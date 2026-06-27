package cz.fit.cvut.seatlock.repository;

import cz.fit.cvut.seatlock.domain.User;
import static cz.fit.cvut.seatlock.generated.Tables.*;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final DSLContext dsl;

    public Optional<User> findUserByEmail(String email) {
        return dsl.selectFrom(APP_USER)
                .where(APP_USER.EMAIL.eq(email))
                .fetchOptionalInto(User.class);
    }

    public Optional<User> findUserByPhoneNumber(String phoneNumber) {
        return dsl.selectFrom(APP_USER)
                .where(APP_USER.PHONE_NUMBER.eq(phoneNumber))
                .fetchOptionalInto(User.class);
    }

    public Optional<User> findById(UUID id) {
        return dsl.selectFrom(APP_USER)
                .where(APP_USER.ID.eq(id))
                .fetchOptionalInto(User.class);
    }

    public User save(User user) {
        var record = dsl.newRecord(APP_USER, user);
        if (user.getRole() != null) {
            record.setRole(user.getRole().name());
        }
        if (user.getId() == null) {
            record.setId(UUID.randomUUID());
            record.insert();
        } else {
            record.update();
        }
        return record.into(User.class);
    }

    public boolean updateRoleToOrganization(UUID userId) {
        // SQL: UPDATE app_user SET role = 'ROLE_ORGANIZATION' WHERE id = '...'
        int rowsUpdated = dsl.update(APP_USER)
                .set(APP_USER.ROLE, "ROLE_ORGANIZATION")
                .where(APP_USER.ID.eq(userId))
                .execute();

        return rowsUpdated > 0;
    }
}
