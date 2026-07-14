package validation

import "encoding/hex"

// IsUUID reports whether value is a canonical, hyphenated UUID.
func IsUUID(value string) bool {
	if len(value) != 36 || value[8] != '-' || value[13] != '-' || value[18] != '-' || value[23] != '-' {
		return false
	}

	var encoded [32]byte
	n := 0
	for i := range value {
		if value[i] == '-' {
			continue
		}
		encoded[n] = value[i]
		n++
	}

	var decoded [16]byte
	_, err := hex.Decode(decoded[:], encoded[:])
	return err == nil
}
