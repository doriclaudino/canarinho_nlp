import spacy
from spacy.matcher import Matcher
from spacy.tokens import Token

#using tokens

nlp = spacy.load('pt_core_news_sm')
matcher = Matcher(nlp.vocab)
pattern = [{"ORTH": "("}, {"SHAPE": "ddd"}, {"ORTH": ")"}, {"SHAPE": "ddd"},
           {"ORTH": "-", "OP": "?"}, {"SHAPE": "ddd"}]
matcher.add("PHONE_NUMBER", None, pattern)

doc = nlp(u"Call me at +1 (123) 456 789 or (123) 456 789!")

# Register token extension
Token.set_extension("is_phone_number", default=False)

matches = matcher(doc)
hashtags = []
for match_id, start, end in matches:
    if doc.vocab.strings[match_id] == "PHONE_NUMBER":
        hashtags.append(doc[start:end])
with doc.retokenize() as retokenizer:
    for span in hashtags:
        retokenizer.merge(span)
        for token in span:
            token._.is_phone_number = True

for token in doc:
    print(token.text, ' -> ', token._.is_phone_number)
