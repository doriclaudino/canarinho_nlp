train_data = ([('suck', 'JOB,OFFER,ASK'), ('fuck', 'JOB,OFFER,ASK'),
               ('sucked', ['JOB','OFFER','ASK']), ('ok', 'JOB,OFFER,ASK'), ('good', 'JOB,OFFER,ASK,CONSTRUCTION,CLEANING,GENERAL,OFFICE')])
texts, labels = zip(*train_data)


def flatsublists(_tuple):
    flat_list = []
    _list = list(_tuple)
    for sublist in _list:
        if isinstance(sublist, str):
            sublist = sublist.split(',')
        for item in sublist:
            if item not in flat_list:
                flat_list.append(item)
    return flat_list


def translateToDict(_list, _all):
    if isinstance(_list, str):
        _list = _list.split(',')

    dict = {}
    for item in _all:
        if item in _list:
            dict[item] = True
        else:
            dict[item] = False
    return [dict]


fulllist = flatsublists(labels)
print(translateToDict('JOB,OFFER', fulllist))
