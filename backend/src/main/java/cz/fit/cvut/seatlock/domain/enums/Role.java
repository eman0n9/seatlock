package cz.fit.cvut.seatlock.domain.enums;

import org.jspecify.annotations.Nullable;
import org.springframework.security.core.GrantedAuthority;

public enum Role implements GrantedAuthority {
    ROLE_CUSTOMER,
    ROLE_ADMIN,
    ROLE_ORGANIZATION;

    @Override
    public @Nullable String getAuthority() {
        return name();
    }
}
