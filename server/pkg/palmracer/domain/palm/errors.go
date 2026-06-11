// Package palm 刷掌平台代理领域 sentinel error 定义。
package palm

import (
	"errors"
	"regexp"
)

// userIDPattern user_id 合法字符集：字母、数字、短横线、下划线。
var userIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

// 刷掌平台代理领域的业务错误。
var (
	// ErrUserIDEmpty user_id 必填。
	ErrUserIDEmpty = errors.New("palm: user_id is required")

	// ErrUserIDInvalid user_id 格式非法。
	ErrUserIDInvalid = errors.New("palm: user_id invalid (length 1-64, only letters/digits/underscore/dash allowed)")

	// ErrRgbImageEmpty rgb_image 必填。
	ErrRgbImageEmpty = errors.New("palm: rgb_image is required")

	// ErrRgbImageDataEmpty rgb_image.data 必填。
	ErrRgbImageDataEmpty = errors.New("palm: rgb_image.data is required")

	// ErrRgbImageTypeInvalid rgb_image.image_type 非法。
	ErrRgbImageTypeInvalid = errors.New("palm: rgb_image.image_type invalid")

	// ErrPalmProxyUnreachable 无法连接刷掌平台。
	ErrPalmProxyUnreachable = errors.New("palm: palm proxy unreachable")
)

// Validate 校验 SearchRgbPalmRequest 必填项。
func (r *SearchRgbPalmRequest) Validate() error {
	if r == nil {
		return ErrRgbImageEmpty
	}
	if r.RgbImage == nil {
		return ErrRgbImageEmpty
	}
	if r.RgbImage.Data == "" {
		return ErrRgbImageDataEmpty
	}
	if r.RgbImage.ImageType <= 0 {
		return ErrRgbImageTypeInvalid
	}
	return nil
}

// Validate 校验 RegisterRgbPalmRequest 必填项。
func (r *RegisterRgbPalmRequest) Validate() error {
	if r == nil {
		return ErrRgbImageEmpty
	}
	if r.UserId == "" {
		return ErrUserIDEmpty
	}
	if len(r.UserId) > 64 || !userIDPattern.MatchString(r.UserId) {
		return ErrUserIDInvalid
	}
	if r.RgbImage == nil {
		return ErrRgbImageEmpty
	}
	if r.RgbImage.Data == "" {
		return ErrRgbImageDataEmpty
	}
	if r.RgbImage.ImageType <= 0 {
		return ErrRgbImageTypeInvalid
	}
	return nil
}
