<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Aside from '$lib/components/glue/Aside.svelte';
	import Main from '$lib/components/glue/Main.svelte';
	import PageContainer from '$lib/components/glue/PageContainer.svelte';
	import TextInput from '$lib/components/glue/TextInput.svelte';
	import HotTopics from '$lib/components/HotTopics.svelte';
	import QuestionThread from '$lib/components/QuestionThread.svelte';
	import TopicListItem from '$lib/components/TopicListItem.svelte';
	import { pb } from '$lib/glue/pocketbase';
	import IconDownKarat from '$lib/icons/glue/IconDownKarat.svelte';
	import debounce from 'just-debounce-it';
	import { MeiliSearch } from 'meilisearch';
	import { onMount } from 'svelte';

	const client = new MeiliSearch({
		host: 'https://meilisearch-production-023b.up.railway.app/',
		apiKey: 'BpNG6BkFrQBQ3aOB3ao6yRMwGHnJzbFUt9k6MDZzNJ'
	});

	let hits = [];
	let popularCourses = [];
	let processingTimeMs = 0;
	let estimatedTotalHits = 0;
	let query = $page.url.searchParams.get('query');
	let feedQuestionThreads = [];
	let feedPage = 1;
	let feedStats = null;
	let isSearchFocused = false;
	let topSearches = [];

	const handleChangeQuery = (newQuery) => {
		query = newQuery;
		debouncedSearchByQuery(newQuery);
	};

	const searchByQuery = async (query) => {
		if (query?.length > 0) {
			$page.url.searchParams.set('query', query);
			goto(`?${$page.url.searchParams.toString()}`, {
				keepFocus: true
			});
		} else {
			$page.url.searchParams.delete('query');
			goto(`?${$page.url.searchParams.toString()}`, {
				keepFocus: true
			});
		}

		// reset hits before searching to prevent
		// previous hits from flashing
		hits = [];
		pageNumber = 1;

		const res = await client.index('topics').search(query);

		hits = res?.hits;
		processingTimeMs = res?.processingTimeMs || 0;
		estimatedTotalHits = res?.estimatedTotalHits || 0;

		if (import.meta.env.MODE === 'production' && query?.length > 0) {
			pb.collection('logs').create({
				variant: 'search',
				value: query
			});
		}
	};

	const debouncedSearchByQuery = debounce(searchByQuery, 500);

	const fetchFeedQuestionThreads = async () => {
		const questions = await pb.collection('questions').getList(feedPage, 30, {
			sort: '-providerCreated',
			expand: 'topic'
		});
		feedStats = questions;

		const promises = questions?.items?.map(async (question) => {
			const answers = await pb.collection('answers').getFullList(200, {
				filter: `question='${question?.id}'`,
				$autoCancel: false
			});
			return {
				...question,
				answers
			};
		});
		const newThreads = await Promise.all(promises);
		feedQuestionThreads = [...feedQuestionThreads, ...newThreads];
	};

	const loadMoreThreads = () => {
		feedPage += 1;
		fetchFeedQuestionThreads();
	};

	const fetchSearchLogs = async () => {
		const logs = await pb.collection('logs').getList(1, 200, {
			filter: `variant='search'`,
			sort: '-created'
		});

		const keywordCount = {};

		logs?.items?.forEach((log) => {
			const keyword = log?.value?.trim();
			keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
		});

		const keywords = Object.keys(keywordCount).map(function (key) {
			return [key, keywordCount[key]];
		});

		keywords.sort(function (first, second) {
			return second[1] - first[1];
		});

		topSearches = keywords.slice(0, 10);
	};

	onMount(async () => {
		fetchFeedQuestionThreads();
		searchByQuery(query);
		fetchSearchLogs();
		const coursesData = await pb.collection('topics').getList(1, 4, {
			filter: "category='course'",
			sort: '-pageView'
		});
		popularCourses = coursesData?.items || [];
	});

	const SUGGESTED_SEARCH_QUERIES = ['dance clubs', 'sophomore dorms', 'info 1300'];

	// load more
	let pageNumber = 1;

	const loadMore = async () => {
		pageNumber += 1;

		const res = await client.index('topics').search(query, {
			hitsPerPage: 20,
			page: pageNumber
		});

		hits = [...hits, ...res?.hits];
	};
</script>

<PageContainer title="Home" layout="aside-main">
	<Main>
		<div class="space-y-4">
			<div
				class="ml-[-0.5rem] rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-0.5"
			>
				<TextInput
					bind:value={query}
					on:input={(event) => {
						handleChangeQuery(event?.target?.value);
					}}
					placeholder="????  Search for a topic"
					class="w-full rounded-full pl-4"
					on:focus={() => {
						isSearchFocused = true;
					}}
					on:blur={() => {
						isSearchFocused = false;
					}}
				/>
			</div>
			<div>
				<!-- suggested search buttons -->
				<!-- <div class="flex items-center space-x-2 overflow-auto pb-3">
					{#each SUGGESTED_SEARCH_QUERIES as queryString, idx (queryString)}
						<button class="btn-outline btn-sm btn" on:click={() => handleChangeQuery(queryString)}
							>{queryString}</button
						>
					{/each}
				</div> -->

				{#if Boolean(query)}
					<!-- topic search results -->
					<p class="mt-4 text-sm text-base-content/80">
						{estimatedTotalHits} of 7890 found in {processingTimeMs} milliseconds
					</p>
					<div class="space-y-2">
						{#each hits as hit (hit.id)}
							<TopicListItem topic={hit} />
						{/each}
					</div>
					{#if hits?.length > 0}
						<div class="mt-4 mb-12">
							<div class="">
								<button class="btn-primary btn gap-1 rounded-full" on:click={loadMore}
									><span class="text-2xl"><IconDownKarat /></span> Load more</button
								>
							</div>
							<div class="mt-4 ml-2 text-sm text-base-content/80">
								<p>
									Search results might start to become inaccurate if you load more search results.
								</p>
							</div>
						</div>
					{/if}
				{:else if isSearchFocused}
					<div class="mt-8">
						<h3 class="mb-4 ml-3 text-xl font-bold">Popular searches</h3>
						<div class="space-y-2">
							{#each topSearches as [topSearch], idx (topSearch)}
								<div>
									<button
										type="button"
										class="btn-ghost btn-sm btn text-lg"
										on:mousedown={(event) => {
											event?.preventDefault();
										}}
										on:click={() => {
											handleChangeQuery(topSearch);
										}}
										><span class="mr-3 text-base-content/70">{('0' + (idx + 1)).slice(-2)}</span>
										{topSearch}</button
									>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<!-- discussion feed -->
					<div class="mt-12 space-y-4">
						<p>
							Showing <span class="font-bold">{feedStats?.perPage * feedPage}</span> of
							<span class="font-bold">{feedStats?.totalItems}</span> discussions
						</p>
						<div class="space-y-2">
							{#each feedQuestionThreads as thread (thread?.id)}
								<QuestionThread {thread} topic={thread?.expand?.topic} />
							{/each}
						</div>
						<button class="btn-primary btn rounded-full px-6" on:click={loadMoreThreads}
							>Load more</button
						>
					</div>
				{/if}
			</div>
		</div>
	</Main>
	<Aside>
		<HotTopics />
	</Aside>
</PageContainer>

<style>
	#icon-search {
		font-size: 1.6rem;
	}
</style>
