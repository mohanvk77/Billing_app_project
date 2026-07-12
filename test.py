class Solution(object):
    def isAnagram(self, s, t):
        lookup_s = {}
        for char in s:
            if char in lookup_s:
                lookup_s[char] += 1
            else:
                lookup_s[char] = 1
        print(lookup_s)
        lookup_t = {}
        for char in t:
            if char in lookup_t:
                lookup_t[char] += 1
            else:
                lookup_t[char] = 1
        print(lookup_t)
        return lookup_s == lookup_t

# Test code
obj = Solution()
result = obj.isAnagram(s = "anagram", t = "nagaram")
print(result)