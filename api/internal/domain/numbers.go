package domain

import "strconv"

func formatFloat(f float64) string { return strconv.FormatFloat(f, 'f', -1, 64) }

func parseFloat(s string) (float64, error) { return strconv.ParseFloat(s, 64) }

func parseInt64(s string) (int64, error) { return strconv.ParseInt(s, 10, 64) }
