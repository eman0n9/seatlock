package validation

import "testing"

func TestIsUUID(t *testing.T) {
	tests := []struct {
		value string
		want  bool
	}{
		{value: "550e8400-e29b-41d4-a716-446655440000", want: true},
		{value: "550E8400-E29B-41D4-A716-446655440000", want: true},
		{value: ""},
		{value: "550e8400e29b41d4a716446655440000"},
		{value: "550e8400-e29b-41d4-a716-44665544000z"},
	}

	for _, tt := range tests {
		if got := IsUUID(tt.value); got != tt.want {
			t.Errorf("IsUUID(%q) = %v, want %v", tt.value, got, tt.want)
		}
	}
}
