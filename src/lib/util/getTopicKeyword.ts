const getTopicKeyword = (topic) => {
	let keyword = topic?.name?.toLowerCase();

	if (topic?.category === 'dorm' && keyword?.split(' ').pop() === 'hall') {
		const lastIndex = keyword.lastIndexOf(' ');
		keyword = keyword.substring(0, lastIndex);
	}

	if (topic?.category === 'club') {
		keyword = keyword?.replace('at cornell uniersity', '');
		keyword = keyword?.replace('at cornell', '');
	}

	return keyword;
};

export default getTopicKeyword;
