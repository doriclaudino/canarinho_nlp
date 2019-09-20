from spacy.lang.pt import Portuguese
from spacy.matcher import PhraseMatcher

nlp = Portuguese()
matcher = PhraseMatcher(nlp.vocab, attr="SHAPE")
matcher.add("PHONE_NUMBER", None, nlp(u"+1 702 366 4244"),
            nlp(u"+17023664244"), nlp(u'702 366 4243'), nlp(u'702.366.4243')
            ,nlp(u'1.702.366.4243'))

doc = nlp(u"A +1 702 366 8888 A +13333334444 A 702 366 4444 b 702 3664444 702.555.4243")
for match_id, start, end in matcher(doc):
    print("Matched based on token shape:", doc[start:end])
